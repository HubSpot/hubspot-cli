---
name: hubspot-new-app
description: Plan and create a HubSpot developer-platform app project with the HubSpot CLI MCP tools. Use when the user wants to build, start, or scaffold a HubSpot developer-platform app project (an `hsproject.json` project). Also use when the user wants to add features such as cards, webhooks, workflow actions, or app functions to a project. Also use when the user has only a rough idea and needs help to choose features, distribution, and auth type. The skill ends with a local project that passes validation. It does not upload or deploy.
disable-model-invocation: false
allowed-tools: Read, Grep, Glob
argument-hint: '[app-idea]'
---

# Plan and create a HubSpot app project

Use this skill to turn an idea into a local HubSpot project that passes validation. The first upload fixes two choices: distribution and auth type. A wrong choice means a new project, so plan before you scaffold.

Never choose distribution, auth type, project name, or destination for the user. Ask.

The tools in this skill come from the HubSpot CLI MCP server, which `hs mcp setup` adds as `HubSpotDev`. If more than one server has a tool with the same name, use the one from `HubSpotDev`.

## Task

When this skill is invoked:

### 1. Find the starting point

1. If the user wants to add features to an existing project, call `find-projects` on the working directory, then skip to step 4 and use `add-feature-to-project`. If the user wants a new app, do not call `find-projects`. If you cannot tell which one the user wants, ask.
2. If any tool reports "No account ID found", or no account is authenticated, call `auth-account`. Tell the user that a browser tab opens and that they must click "Connect to CLI". Then retry the blocked step.
3. If the user wants a safe place to test, offer `create-test-account`. Follow that tool's own workflow: look for a test account config file, show it to the user, and ask before you use it. If there is no file, ask for the account name and the tier for each hub.

### 2. Plan

If the user already stated what the app does, the features, the distribution, and the auth type, skip this step.

1. If the user passed an app idea as an argument (for example `/hubspot-new-app a card that shows open tickets`), use it. Otherwise ask one question: what must the app do for its users?
2. Call `search-docs` for that goal. Call `fetch-doc` on the best results. Choose features from the docs. The valid feature values are:

   ```
   card, settings, app-function, app-function-endpoint, webhooks,
   workflow-action, workflow-action-tool, app-object, app-event,
   scim, page, crm-bulk-action
   ```

3. Keep these features apart:
   - `app-function` is a private serverless function inside the app.
   - `app-function-endpoint` is an app serverless function with a public endpoint.
   - `workflow-action-tool` is an agent tool.
   - Do not confuse any of them with a CMS serverless function. That is a different product.
4. If a fetched doc has a "Supported products" section, tell the user the required product and tier in plain words. For example: "This feature requires Content Hub Enterprise." Do this before you scaffold. If no fetched doc has that section, do not state a tier.
5. Ask for the distribution:
   - `private`: the app is not listed on the HubSpot marketplace.
   - `marketplace`: the app is listed on the HubSpot marketplace.
6. Ask for the auth type. `oauth` works for both distributions. `static` works only with `private` distribution.
7. Ask for the project name. Ask for the destination directory. The destination becomes the project folder itself, so use the exact path that the user gives. Do not use the current directory unless the user says so.
8. After the user answers, show the full plan: name, destination, project base (`app` or `empty`), distribution, auth type, and features.
9. Ask "Create this project?" Say that distribution and auth type cannot change after the first upload. Wait for a yes in a separate reply. Answers to your questions are not a yes. Do not call `create-project` or `add-feature-to-project` before the yes.

### 3. Create a new project

Call `create-project` with every value from the plan:

- `name`, `destination`
- `projectBase`: `app` for a project with an app, `empty` for a project without one
- `distribution` and `auth` (for base `app` only)
- `features`

If the tool answers with a question, ask the user. Do not guess a value.

### 4. Add features to an existing project

Call `add-feature-to-project` with `absoluteProjectPath` and `features`.

- If the project has no app, set `addApp` to `true`. A project needs an app before it can hold a feature.
- When `addApp` is `true`, pass `distribution` and `auth`. Ask the user for them, as in step 2. Otherwise omit them.

### 5. Configure and validate

1. Open `hsproject.json` and read `platformVersion`.
2. Before you edit any `*-hsmeta.json` file, call `get-feature-config-schema` with that `platformVersion` and the `type` field from the file. Use only the values the schema allows.
3. Edit the file.
4. If a feature reads or writes CRM data, add the scopes it needs to `requiredScopes` in `app-hsmeta.json`. The schema does not list scope names, so find the exact names with `search-docs` and `fetch-doc`.
5. Call `validate-project`. Fix each error and call it again. Repeat until it passes. If you cannot fix an error, show the error text to the user without changes.

### 6. Finish

Tell the user which files you created and which features the project has. Tell them that the project is ready to upload, and that the first upload makes distribution and auth type permanent.

Do not call `upload-project` in this skill. Stop here. If the user asks to upload later, treat it as a new request. If that build fails, use the `hubspot-fix-build` skill.
