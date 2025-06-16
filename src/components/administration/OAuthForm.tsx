import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Key, Globe, Shield } from "lucide-react";
import { TenantFormData } from "@/lib/types";

const oauthSchema = z.object({
  name: z
    .string()
    .min(1, "Tenant name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  baseUrl: z
    .string()
    .url("Please enter a valid URL")
    .refine((url) => url.startsWith("https://"), "Base URL must use HTTPS"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
  tokenUrl: z
    .string()
    .url("Please enter a valid token URL")
    .refine((url) => url.startsWith("https://"), "Token URL must use HTTPS"),
  scope: z.string().optional(),
  grantType: z.enum(["client_credentials", "authorization_code"]),
  audience: z.string().optional(),
  redirectUri: z
    .string()
    .url("Please enter a valid redirect URI")
    .optional()
    .or(z.literal("")),
  isBaseTenant: z.boolean().optional(),
});

type OAuthFormData = z.infer<typeof oauthSchema>;

interface OAuthFormProps {
  onSubmit: (data: TenantFormData) => void;
  isLoading: boolean;
  error?: string;
}

const OAuthForm: React.FC<OAuthFormProps> = ({
  onSubmit,
  isLoading,
  error,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<OAuthFormData>({
    resolver: zodResolver(oauthSchema),
    defaultValues: {
      grantType: "client_credentials",
      baseUrl: "https://",
      tokenUrl: "https://",
    },
  });

  const grantType = watch("grantType");

  const handleFormSubmit = (data: OAuthFormData) => {
    const formattedData: TenantFormData = {
      name: data.name,
      description: data.description,
      baseUrl: data.baseUrl,
      isBaseTenant: data.isBaseTenant,
      oauthCredentials: {
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        tokenUrl: data.tokenUrl,
        scope: data.scope,
        grantType: data.grantType,
        audience: data.audience,
        redirectUri: data.redirectUri || undefined,
      },
    };
    onSubmit(formattedData);
  };

  const handleReset = () => {
    reset({
      grantType: "client_credentials",
      baseUrl: "https://",
      tokenUrl: "https://",
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tenant Information Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Tenant Information</CardTitle>
          </div>
          <CardDescription>
            Basic information about the SAP Integration Suite tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Tenant Name *
            </Label>
            <Input
              id="name"
              placeholder="e.g., Production SAP IS"
              {...register("name")}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Optional description of this tenant"
              rows={3}
              {...register("description")}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">
                {errors.description.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="baseUrl" className="text-sm font-medium">
              Base URL *
            </Label>
            <Input
              id="baseUrl"
              placeholder="https://your-tenant.sap.com"
              {...register("baseUrl")}
              className={errors.baseUrl ? "border-red-500" : ""}
            />
            {errors.baseUrl && (
              <p className="text-sm text-red-600 mt-1">
                {errors.baseUrl.message}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Checkbox id="isBaseTenant" {...register("isBaseTenant")} />
            <div className="space-y-1">
              <Label
                htmlFor="isBaseTenant"
                className="text-sm font-medium text-blue-900"
              >
                Base Tenant
              </Label>
              <p className="text-xs text-blue-700">
                Mark this tenant as a base tenant to automatically display its
                packages and iFlows in the CI/CD Pipeline
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OAuth Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">OAuth Configuration</CardTitle>
          </div>
          <CardDescription>
            OAuth 2.0 credentials for authenticating with the SAP Integration
            Suite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientId" className="text-sm font-medium">
                Client ID *
              </Label>
              <Input
                id="clientId"
                placeholder="Your OAuth client ID"
                {...register("clientId")}
                className={errors.clientId ? "border-red-500" : ""}
              />
              {errors.clientId && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.clientId.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="clientSecret" className="text-sm font-medium">
                Client Secret *
              </Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder="Your OAuth client secret"
                {...register("clientSecret")}
                className={errors.clientSecret ? "border-red-500" : ""}
              />
              {errors.clientSecret && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.clientSecret.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="tokenUrl" className="text-sm font-medium">
              Token URL *
            </Label>
            <Input
              id="tokenUrl"
              placeholder="https://your-tenant.sap.com/oauth/token"
              {...register("tokenUrl")}
              className={errors.tokenUrl ? "border-red-500" : ""}
            />
            {errors.tokenUrl && (
              <p className="text-sm text-red-600 mt-1">
                {errors.tokenUrl.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="grantType" className="text-sm font-medium">
              Grant Type *
            </Label>
            <Select
              value={grantType}
              onValueChange={(value) => setValue("grantType", value as any)}
            >
              <SelectTrigger
                className={errors.grantType ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Select grant type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_credentials">
                  Client Credentials
                </SelectItem>
                <SelectItem value="authorization_code">
                  Authorization Code
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.grantType && (
              <p className="text-sm text-red-600 mt-1">
                {errors.grantType.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scope" className="text-sm font-medium">
                Scope
              </Label>
              <Input
                id="scope"
                placeholder="e.g., read write admin"
                {...register("scope")}
                className={errors.scope ? "border-red-500" : ""}
              />
              {errors.scope && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.scope.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="audience" className="text-sm font-medium">
                Audience
              </Label>
              <Input
                id="audience"
                placeholder="OAuth audience (optional)"
                {...register("audience")}
                className={errors.audience ? "border-red-500" : ""}
              />
              {errors.audience && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.audience.message}
                </p>
              )}
            </div>
          </div>

          {grantType === "authorization_code" && (
            <div>
              <Label htmlFor="redirectUri" className="text-sm font-medium">
                Redirect URI
              </Label>
              <Input
                id="redirectUri"
                placeholder="https://your-app.com/callback"
                {...register("redirectUri")}
                className={errors.redirectUri ? "border-red-500" : ""}
              />
              {errors.redirectUri && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.redirectUri.message}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isLoading}
        >
          Reset Form
        </Button>

        <div className="flex items-center space-x-3">
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Test & Register Tenant
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default OAuthForm;
