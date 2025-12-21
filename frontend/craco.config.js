// craco.config.js
const path = require("path");
require("dotenv").config();

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === "true",
  enableVisualEdits: process.env.REACT_APP_ENABLE_VISUAL_EDITS === "true",
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load visual editing modules only if enabled
let babelMetadataPlugin;
let setupDevServer;

if (config.enableVisualEdits) {
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  eslint: {
    enable: false,
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env }) => {
      // Remove react-refresh in production to fix "React Refresh runtime should not be included in the production bundle" error
      if (env === 'production') {
        // Remove ReactRefreshPlugin from webpack plugins
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          const name = plugin.constructor.name;
          return name !== 'ReactRefreshPlugin' && name !== 'ReactRefreshWebpackPlugin';
        });
        
        // Remove react-refresh/babel from babel-loader
        webpackConfig.module.rules.forEach(rule => {
          if (rule.oneOf) {
            rule.oneOf.forEach(oneOfRule => {
              if (oneOfRule.loader && oneOfRule.loader.includes('babel-loader')) {
                if (oneOfRule.options && oneOfRule.options.plugins) {
                  oneOfRule.options.plugins = oneOfRule.options.plugins.filter(
                    plugin => !String(plugin).includes('react-refresh')
                  );
                }
              }
              if (oneOfRule.use) {
                oneOfRule.use.forEach(useRule => {
                  if (useRule.loader && useRule.loader.includes('babel-loader')) {
                    if (useRule.options && useRule.options.plugins) {
                      useRule.options.plugins = useRule.options.plugins.filter(
                        plugin => !String(plugin).includes('react-refresh')
                      );
                    }
                  }
                });
              }
            });
          }
        });
      }

      // Disable hot reload completely if environment variable is set
      if (config.disableHotReload) {
        // Remove hot reload related plugins
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          return !(plugin.constructor.name === 'HotModuleReplacementPlugin');
        });

        // Disable watch mode
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // Ignore all files
        };
      } else {
        // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
          ],
        };
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      return webpackConfig;
    },
  },
};

// Configure babel
webpackConfig.babel = {
  plugins: config.enableVisualEdits ? [babelMetadataPlugin] : [],
  loaderOptions: (babelLoaderOptions) => {
    // Remove react-refresh babel plugin in production
    if (process.env.NODE_ENV === 'production') {
      if (babelLoaderOptions.plugins) {
        babelLoaderOptions.plugins = babelLoaderOptions.plugins.filter(
          plugin => {
            const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
            return !String(pluginName).includes('react-refresh');
          }
        );
      }
    }
    return babelLoaderOptions;
  },
};

// Setup dev server with visual edits and/or health check
if (config.enableVisualEdits || config.enableHealthCheck) {
  webpackConfig.devServer = (devServerConfig) => {
    // Apply visual edits dev server setup if enabled
    if (config.enableVisualEdits && setupDevServer) {
      devServerConfig = setupDevServer(devServerConfig);
    }

    // Add health check endpoints if enabled
    if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
      const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

      devServerConfig.setupMiddlewares = (middlewares, devServer) => {
        // Call original setup if exists
        if (originalSetupMiddlewares) {
          middlewares = originalSetupMiddlewares(middlewares, devServer);
        }

        // Setup health endpoints
        setupHealthEndpoints(devServer, healthPluginInstance);

        return middlewares;
      };
    }

    return devServerConfig;
  };
}

module.exports = webpackConfig;
