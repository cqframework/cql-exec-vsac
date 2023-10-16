const nock = require('nock');

// Root hook to run before all test suites
before(function () {
  // These tests should never reach out to the network.  If they do, we've done something wrong!
  nock.disableNetConnect();
});

// Root hook to run after all test suites
after(function () {
  nock.restore();
  nock.enableNetConnect();
});
