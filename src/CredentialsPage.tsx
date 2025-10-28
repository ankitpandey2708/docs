import { useEffect, useState } from "react";
import { Head } from "zudoku/components";
import { useAuth } from "zudoku/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "zudoku/ui/Card";
import { Badge } from "zudoku/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "zudoku/ui/Alert";
import { Secret } from "zudoku/ui/Secret";
import { KeyIcon, AlertCircleIcon, CheckCircleIcon } from "zudoku/icons";

// Determine backend URL based on environment
const getBackendUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  return window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : window.location.origin;
};

interface WorkspaceCredentials {
  clientId: string;
  clientSecret: string;
  workspace: string;
  tokenUrl: string;
  apiBaseUrl: string;
  flowIds: {
    nerv: string;
    recurring: string;
  };
}

export const CredentialsPage = () => {
  const [credentials, setCredentials] = useState<WorkspaceCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        // Extract workspace from auth context
        const workspace = (auth as any).providerData?.user?.publicMetadata?.workspace;
        
        // Build URL with workspace parameter if available
        let url = `${getBackendUrl()}/api/workspace/credentials`;
        if (workspace) {
          url += `?workspace=${encodeURIComponent(workspace)}`;
        }

        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch credentials: ${response.statusText}`);
        }

        const data = await response.json();
        setCredentials(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch credentials');
      } finally {
        setLoading(false);
      }
    };

    fetchCredentials();
  }, []);

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

      
        {loading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading credentials...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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
                      {credentials.workspace}
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
