module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    // keep other plugins before Reanimated's plugin
    'react-native-reanimated/plugin', // must be last
  ],
}
