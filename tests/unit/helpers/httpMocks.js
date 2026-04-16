function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function createReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    session: {},
    ...overrides,
  };
}

module.exports = {
  createReq,
  createRes,
};
