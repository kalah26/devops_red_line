/**
 * Default model for the assistant: Amazon Nova Micro through the cross-region
 * inference profile for the deployment region's geography. Override with
 * `-c bedrockModelId=<model or inference profile id>`.
 */
export function defaultBedrockModelId(region: string): string {
  if (region.startsWith('eu-')) return 'eu.amazon.nova-micro-v1:0';
  if (region.startsWith('ap-')) return 'apac.amazon.nova-micro-v1:0';
  return 'us.amazon.nova-micro-v1:0';
}
