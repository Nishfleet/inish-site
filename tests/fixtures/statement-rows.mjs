export const cleanStatementRows = [
  {
    date: "2026-04-01",
    description: "Opening deposit",
    money_in: 1000,
    money_out: "",
    balance: 1000,
    page: 1,
    confidence: 0.91
  },
  {
    date: "2026-04-02",
    description: "Card purchase",
    money_in: "",
    money_out: 45.25,
    balance: 954.75,
    page: 1,
    confidence: 0.9
  },
  {
    date: "2026-04-03",
    description: "Payroll",
    money_in: 500,
    money_out: "",
    balance: 1454.75,
    page: 1,
    confidence: 0.92
  },
  {
    date: "2026-04-04",
    description: "ATM withdrawal",
    money_in: "",
    money_out: 100,
    balance: 1354.75,
    page: 2,
    confidence: 0.9
  }
];

export const balanceMismatchRows = [
  cleanStatementRows[0],
  cleanStatementRows[1],
  {
    ...cleanStatementRows[2],
    balance: 1450
  },
  {
    ...cleanStatementRows[3],
    balance: 1350
  }
];

export const duplicateRows = [
  ...cleanStatementRows,
  {
    ...cleanStatementRows[1]
  }
];

export const twoSidedRows = [
  cleanStatementRows[0],
  {
    ...cleanStatementRows[1],
    money_in: 25
  },
  {
    ...cleanStatementRows[2],
    money_out: 10
  },
  cleanStatementRows[3]
];

export const weakCoverageRows = [
  {
    date: "2026-04-01",
    description: "Opening deposit",
    money_in: 1000,
    money_out: "",
    balance: 1000,
    page: "",
    confidence: 0.7
  },
  {
    date: "not a date",
    description: "Unknown line",
    money_in: "",
    money_out: "",
    balance: "",
    page: "",
    confidence: 0.42
  },
  {
    date: "",
    description: "Card purchase",
    money_in: "",
    money_out: 45.25,
    balance: 954.75,
    page: "",
    confidence: 0.6
  }
];
