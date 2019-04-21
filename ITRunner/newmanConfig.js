module.exports = {
  collection: undefined,
    reporter: { html: { export: undefined } },
  globals: {
    values: [
      {
        key: 'serverPort',
        value: undefined,
        type: 'text',
        enabled: true,
      }, {
        key: 'serverHost',
        value: 'localhost',
        type: 'text',
        enabled: true,
      }, {
        key: 'serverProtocol',
        value: 'http',
        type: 'text',
        enabled: true,
      },
    ],
  },
  reporters: ['html'],
  // reporters: ['cli', 'html'],
};