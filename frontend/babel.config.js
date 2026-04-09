module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: [
      'nativewind/babel',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@components': './components',
            '@store': './store',
            '@services': './services',
            '@utils': './utils',
            '@types': './types',
          },
        },
      ],
    ],
  };
};
