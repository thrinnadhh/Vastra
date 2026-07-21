const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const apiClientSourceSegment = `${path.sep}packages${path.sep}api-client${path.sep}src${path.sep}`;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = context.resolveRequest;
  const isApiClientSourceImport =
    context.originModulePath.includes(apiClientSourceSegment) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js');

  return resolve(context, isApiClientSourceImport ? moduleName.slice(0, -3) : moduleName, platform);
};

module.exports = config;
