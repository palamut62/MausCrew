# Connect apps through Composio

MausCrew uses one Composio project API key and one reusable Composio Session. That project key is the only Composio credential users need to provide.

## Packaged desktop app

1. Open the [Composio Dashboard](https://dashboard.composio.dev).
2. Select **Platform**, select or create a project, then open **Settings → API Keys**.
3. Copy a project key beginning with `ak_`.
4. In MausCrew, open **App Settings → Connections** and save it under **Composio project key**.
5. Open **Connected apps** and choose Gmail, GitHub, Slack, or another service. Authentication happens in your normal browser.

The desktop app validates the key before saving it. The key is encrypted using Electron's operating-system-backed `safeStorage`; the local JSON configuration stores only the non-secret Composio user and Session identifiers.

## Scoped key permissions

A default project API key works without additional configuration. For a least-privilege scoped key, grant:

- **Sessions:** read and write
- **Toolkits:** read
- **Connected accounts:** read and write

Connected-account write access is required so **Disconnect** can revoke the upstream provider grant before removing the connection.

## Running from source

Set the key in the server environment:

```sh
COMPOSIO_API_KEY=ak_your_project_key pnpm dev:server
```

The browser-only development UI can also save a key to the owner-only `~/.mauscrew/config.json` file. Using the environment variable is preferred for headless and shared development machines.

MausCrew creates a stable random user identifier for the installation, stores the returned Session identifier, and reuses that Session across launches. No Gmail, GitHub, Slack, or other provider tokens are stored by MausCrew; Composio owns their connection lifecycle.

## X (Twitter) custom OAuth setup

Composio does not provide a managed OAuth app for the `twitter` toolkit. The Composio project used by MausCrew must therefore contain an enabled custom Twitter Auth Config:

1. Open the [X Developer Console](https://developer.x.com/en/portal/dashboard), create or select a developer app, and enable OAuth 2.0 for a confidential web app.
2. Add this exact callback URI to the X app:

   ```text
   https://backend.composio.dev/api/v3.1/toolkits/auth/callback
   ```

3. Copy the X OAuth Client ID and Client Secret.
4. In the [Composio Dashboard](https://dashboard.composio.dev), select the same project whose `ak_` key is saved in MausCrew.
5. Open authentication management, create an Auth Config for **Twitter**, choose **OAuth2**, enable **Use your own developer credentials**, and enter the X Client ID and Client Secret.
6. Return to **Plugins** in MausCrew and choose **Retry X connection**. MausCrew discovers the enabled Twitter Auth Config and supplies its ID to Composio automatically.

The X Client Secret belongs in Composio, not in MausCrew. MausCrew stores only the Composio project key using the operating system credential store.
