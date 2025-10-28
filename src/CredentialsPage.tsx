import { useEffect, useState } from "react";
import { Head } from "zudoku/components";
import { useAuth } from "zudoku/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "zudoku/ui/Card";
import { Badge } from "zudoku/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "zudoku/ui/Alert";
import { KeyIcon, AlertCircleIcon } from "zudoku/icons";
import type { WorkspaceCredentials } from "./types/credentials";
import { buildCredentialsUrl, extractWorkspace, validateResponse } from "./lib/utils";
import { HEADERS } from "./lib/constants";
import { CredentialField } from "./components/CredentialField";

export const CredentialsPage = () => {
  const [credentials, setCredentials] = useState<WorkspaceCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        // Extract workspace from auth context
        const workspace = extractWorkspace(auth);

        // Build URL with workspace parameter if available
        const url = buildCredentialsUrl(workspace);

        const response = await fetch(url, {
          headers: HEADERS.JSON,
        });

        await validateResponse(response, 'Failed to fetch credentials');

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
                <CredentialField label="Client ID" secret={credentials.clientId} preview={8} />
                <CredentialField label="Client Secret" secret={credentials.clientSecret} preview={8} />
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
                <CredentialField
                  label="Nerv Flow ID (One-time Consent)"
                  secret={credentials.flowIds.nerv}
                  preview={12}
                />
                <CredentialField
                  label="Recurring Flow ID (Recurring Consent)"
                  secret={credentials.flowIds.recurring}
                  preview={12}
                />
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
