const HS_CMS_AUTH_TYPE = 'HS_CMS_AUTH_TYPE';
const HS_CMS_CLIENT_ID = 'HS_CMS_CLIENT_ID';
const HS_CMS_CLIENT_SECRET = 'HS_CMS_CLIENT_SECRET';
const HS_CMS_ACCESS_TOKEN = 'HS_CMS_ACCESS_TOKEN';
const HS_CMS_EXPIRES_AT = 'HS_CMS_EXPIRES_AT';

// * @param {number} configOptions.portalId Portal ID to add/make updates to
// * @param {string} configOptions.authType Type of authentication used for this portalConfig
// * @param {string} configOptions.env Environment that this portal is located in(QA/PROD)
// * @param {string} configOptions.name Unique name used to reference this portalConfig
// * @param {string} configOptions.apiKey API key used in authType: apikey
// * @param {string} configOptions.defaultMode Default mode for uploads(draft or publish)
// * @param {string} configOptions.personalAccessKey Personal Access Key used in authType: personalaccesskey
// * @param {object} configOptions.auth Auth object used in oauth2 and personalaccesskey authTypes
// * @param {string} configOptions.auth.clientId Client ID used for oauth2
// * @param {string} configOptions.auth.clientSecret Client Secret used for oauth2
// * @param {array} configOptions.auth.scopes Scopes that are allowed access with auth
// * @param {object} configOptions.auth.tokenInfo Token Info used for oauth2 and personalaccesskey authTypes
// * @param {string} configOptions.auth.tokenInfo.accessToken Access token used for auth
// * @param {string} configOptions.auth.tokenInfo.expiresAt Date ISO of accessToken expiration

// const CONFIG_SHAPE = {
//   defaultPortal: '',
//   selectedPortal: {}, // index of portal
//   portals: [
//     {
//       portalId: 1, // Portal ID to add/make updates to
//       authType: '', // Type of authentication used for this portalConfig
//       env: '', // Environment that this portal is located in(QA/PROD)
//       name: '', // Unique name used to reference this portalConfig
//       apiKey: '', // API key used in authType: apikey
//       defaultMode: '', // Default mode for uploads(draft or publish)
//       personalAccessKey: '', // Personal Access Key used in authType: personalaccesskey
//       auth: {
//         clientId: '', // Client ID used for oauth2
//         clientSecret: '', // Client Secret used for oauth2
//         scopes: [], // Scopes that are allowed access with auth
//         tokenInfo: {
//           accessToken: '', // Access token used for auth
//           expiresAt: '', // Date ISO of accessToken expiration
//         },
//       },
//     },
//   ],
// };

module.exports = {
  HS_CMS_ACCESS_TOKEN,
  HS_CMS_AUTH_TYPE,
  HS_CMS_CLIENT_ID,
  HS_CMS_CLIENT_SECRET,
  HS_CMS_EXPIRES_AT,
};
