import packageJson from '../../../package.json';

// The version readers are shown, in the update prompt and on the account page.
//
// package.json is the single source: `npm version patch` bumps it, and the
// release build reads the same field when it stamps the service-worker manifest.
// Nothing else may declare a version, or the prompt and the page would disagree.
export const APP_VERSION: string = packageJson.version;
