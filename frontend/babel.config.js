module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
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
