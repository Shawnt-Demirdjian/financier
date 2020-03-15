const cjs = require('chart.js');
const papa = require('papaparse');
const fs = require('fs');

const MAX_DATASETS = 3;
let COUNT_DATASETS = 0;

const transactionsByDate = [];
let maxDate = new Date('01/01/1000');
let minDate = new Date('12/31/9999');

// Create empty chart
// const chartCanvas = $('#chartCanvas');
const chartCanvas = document.getElementById('chartCanvas');
const chartObj = new cjs.Chart(chartCanvas, {
  type: 'line',
  data: {
    datasets: []
  },
  options: {
    scales: {
      xAxes: [{
        type: 'time',
        time: {
          unit: 'week'
        }
      }]
    }
  }
});

const failure = (msg) => {
  console.log('Failure Here: ' + msg);
};

const addMissingDays = () => {
  // add missing days to each dataset in transactionsByDate
  // based on date range from minDate to maxDate
  transactionsByDate.forEach(balancesDataset => {
    let prevDayBalance = 0;

    // eslint doesn't recognize the date modification
    // eslint-disable-next-line no-unmodified-loop-condition
    for (let currDate = new Date(minDate.getTime()); currDate <= maxDate; currDate.setDate(currDate.getDate() + 1)) {
      // step through each day
      const currDateStr = currDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      if (!(currDateStr in balancesDataset)) {
        balancesDataset[currDateStr] = prevDayBalance;
      } else {
        prevDayBalance = balancesDataset[currDateStr];
      }
    }
  });
};

const createSDCCUData = (results) => {
  // create coordinates based on SDCCU date and balance items
  const data = [];

  // Update min/max Date. These look backwards because they are in reverse chronological order
  const currLateDate = new Date(results.data[0].Date);
  const currEarlyDate = new Date(results.data[results.data.length - 1].Date);
  if (currEarlyDate < minDate) {
    minDate = currEarlyDate;
  }
  if (currLateDate > maxDate) {
    maxDate = currLateDate;
  }

  // create balance dictionary for this dataset
  const balancesDataset = {};

  results.data.forEach(transaction => {
    const currBalance = transaction.Balance.replace(/\$|,/g, '');
    if (currBalance !== '') {
      // skip pending transactions with empty balance values
      data.push({
        x: transaction.Date,
        y: currBalance
      });

      // Take the latest value from a single day
      balancesDataset[transaction.Date] = Number(currBalance);
    }
  });

  transactionsByDate.push(balancesDataset);
  // reverse to be in chronological order
  data.reverse();
  return data;
};

const createChaseData = (results) => {
  // reverse to be in chronological order
  results.data.reverse();

  // Update min/max Date. These look backwards because they are in reverse chronological order
  const currLateDate = new Date(results.data[0]['Post Date']);
  const currEarlyDate = new Date(results.data[results.data.length - 1]['Post Date']);
  if (currEarlyDate < minDate) {
    minDate = currEarlyDate;
  }
  if (currLateDate > maxDate) {
    maxDate = currLateDate;
  }

  // create balance dictionary for this dataset
  const balancesDataset = {};

  const data = [];
  let currBalance = 0;
  let currAmount = 0;
  // create coordinates based on Chase data and calculated balance
  results.data.forEach(transaction => {
    currAmount = Number(transaction.Amount);
    currBalance = Number((currBalance + currAmount).toFixed(2));
    data.push({
      x: transaction['Post Date'],
      y: currBalance
    });

    // Take the latest value from a single day
    balancesDataset[transaction['Post Date']] = currBalance;
  });

  transactionsByDate.push(balancesDataset);
  return data;
};

const createTotalData = () => {
  // Only build this after all datasets are ready
  // This probably doesn't work reliably and is subject to race conditions
  // blah blah mutexes and barriers
  if (++COUNT_DATASETS !== MAX_DATASETS) {
    return;
  }

  // Add up balances for every day
  addMissingDays();
  const totalsArr = [];

  // eslint doesn't recognize the date modification
  // eslint-disable-next-line no-unmodified-loop-condition
  for (const currDate = minDate; currDate <= maxDate; currDate.setDate(currDate.getDate() + 1)) {
    // step through each day
    const currDateStr = currDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    let currTotal = 0;
    transactionsByDate.forEach(dataset => {
      currTotal += dataset[currDateStr];
    });

    totalsArr.push({
      x: currDateStr,
      y: Number(currTotal.toFixed(2))
    });
  }

  chartObj.data.datasets.push({
    data: totalsArr,
    label: 'Total',
    borderColor: 'purple',
    fill: 'none',
    lineTension: 0
  });
  chartObj.update();
};

// CHECKING ACCOUNT
fs.readFile('./files/SDCCU-CHECKING.csv', { encoding: 'utf8' }, (err, checkingData) => {
  // Read contents of SDCCU Checking file
  if (err) failure('SDCCU Checking');
  papa.parse(checkingData, {
    // parse contents SDCCU Checking file
    header: true,
    complete: (checkingResults) => {
      // Update chart with SDCCU Checking data
      const checkingData = createSDCCUData(checkingResults);
      chartObj.data.datasets.push({
        data: checkingData,
        label: 'SDCCU Checking',
        borderColor: 'blue',
        fill: 'none',
        lineTension: 0
      });
      chartObj.update();
      createTotalData();
    }
  });
});

// SAVINGS ACCOUNT
fs.readFile('./files/SDCCU-SAVINGS.csv', { encoding: 'utf8' }, (err, savingsData) => {
  // Read contents of SDCCU Savings file
  if (err) failure('SDCCU Savings');
  papa.parse(savingsData, {
    // parse contents SDCCU Savings file
    header: true,
    complete: (savingsResults) => {
      // Update chart with SDCCU Savings data
      const savingsData = createSDCCUData(savingsResults);
      chartObj.data.datasets.push({
        data: savingsData,
        label: 'SDCCU Savings',
        borderColor: 'green',
        fill: 'none',
        lineTension: 0
      });
      chartObj.update();
      createTotalData();
    }
  });
});

// CREDIT ACCOUNT
fs.readFile('./files/CHASE-CREDIT.csv', { encoding: 'utf8' }, (err, creditData) => {
  // Read contents of Chase Credit file
  if (err) failure('Chase Credit');
  papa.parse(creditData, {
    // parse contents Chase Credit file
    header: true,
    complete: (creditResults) => {
      // Update chart with Chase Credit data
      const creditData = createChaseData(creditResults);
      chartObj.data.datasets.push({
        data: creditData,
        label: 'Chase Credit',
        borderColor: 'red',
        fill: 'none',
        lineTension: 0
      });
      chartObj.update();
      createTotalData();
    }
  });
});
