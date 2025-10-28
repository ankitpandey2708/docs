import { Head, Link } from "zudoku/components";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "zudoku/ui/Card";
import { Badge } from "zudoku/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "zudoku/ui/Alert";
import { Secret } from "zudoku/ui/Secret";
import { KeyIcon, AlertCircleIcon, CheckCircleIcon } from "zudoku/icons";

// Static credentials display for reference
// These values match what's configured in your .env file
// The actual authentication is handled automatically by the backend proxy
const WORKSPACE_CREDENTIALS = {
  clientId: 'client-tsfsl-03d952d6',
  clientSecret: '(Hidden - managed by backend)',
  workspace: 'tsfsl',
  tokenUrl: 'https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token',
  apiBaseUrl: 'https://api.finarkein.in/factory/v1',
  flowIds: {
    nerv: '376b71fe-009b-4154-850c-fa0eb65b4d5a',
    recurring: '(Contact administrator for recurring flow ID)'
  }
};

export const CredentialsPage = () => {
  const credentials = WORKSPACE_CREDENTIALS;

  return (
    <>
      <Head>
        <title>Workspace Credentials - Finarkein API</title>
        <meta name="description" content="View your workspace API credentials for the Finarkein API" />
      </Head>

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Workspace Credentials</h1>
          <p className="text-muted-foreground">
            View your workspace-specific OAuth2 credentials and flow IDs. These credentials are automatically used when testing APIs in the API Reference.
          </p>
        </div>

        <Alert className="mb-6">
          <CheckCircleIcon className="h-4 w-4" />
          <AlertTitle>Automatic Authentication</AlertTitle>
          <AlertDescription>
            When you test API endpoints in the <Link to="/api">API Reference</Link>, these credentials are automatically used. You don't need to manually configure anything.
          </AlertDescription>
        </Alert>

        {credentials && (
          <div className="space-y-6">
            {/* Workspace Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyIcon className="h-5 w-5" />
                  Workspace Information
                </CardTitle>
                <CardDescription>
                  Your workspace identifier and API endpoints
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Workspace</label>
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {credentials.workspace.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Token URL</label>
                  <code className="block mt-1 text-sm bg-muted p-2 rounded">
                    {credentials.tokenUrl}
                  </code>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">API Base URL</label>
                  <code className="block mt-1 text-sm bg-muted p-2 rounded">
                    {credentials.apiBaseUrl}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* OAuth2 Credentials */}
            <Card>
              <CardHeader>
                <CardTitle>OAuth2 Credentials</CardTitle>
                <CardDescription>
                  Your client ID and secret for API authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Client ID
                  </label>
                  <Secret
                    secret={credentials.clientId}
                    status="active"
                    preview={8}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Client Secret
                  </label>
                  <Secret
                    secret={credentials.clientSecret}
                    status="active"
                    preview={8}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Flow IDs */}
            <Card>
              <CardHeader>
                <CardTitle>Flow IDs</CardTitle>
                <CardDescription>
                  Flow identifiers for different consent types
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Nerv Flow ID (One-time Consent)
                  </label>
                  <Secret
                    secret={credentials.flowIds.nerv}
                    status="active"
                    preview={12}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Recurring Flow ID (Recurring Consent)
                  </label>
                  <Secret
                    secret={credentials.flowIds.recurring}
                    status="active"
                    preview={12}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Important Note */}
            <Alert>
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                These credentials are managed by administrators. If you need to update them or have any issues, please contact your system administrator.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </>
  );
};
