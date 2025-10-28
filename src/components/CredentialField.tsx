import { Secret } from "zudoku/ui/Secret";

interface CredentialFieldProps {
  label: string;
  secret: string;
  preview?: number;
}

export const CredentialField: React.FC<CredentialFieldProps> = ({
  label,
  secret,
  preview = 8,
}) => (
  <div>
    <label className="text-sm font-medium text-muted-foreground mb-2 block">
      {label}
    </label>
    <Secret secret={secret} status="active" preview={preview} />
  </div>
);
