export type AgentOSPackageName =
  | "@agentos/core"
  | "@agentos/tools"
  | "@agentos/memory"
  | "@agentos/connectors"
  | "@agentos/sdk"
  | "@agentos/types"
  | "@agentos/config";

export const agentOSTypes = {
  name: "@agentos/types",
  description: "Shared domain types for AgentOS packages.",
} as const;

export type AgentOSMetadata = Record<string, unknown>;
export type AgentOSJSONSchema = Record<string, unknown>;
export type AgentOSVariables = Record<string, unknown>;
export type AgentOSEnvironment = Record<string, string | number | boolean | undefined>;
export type MissionMetadata = AgentOSMetadata;
export type CapabilityMetadata = AgentOSMetadata;
export type ResourceMetadata = AgentOSMetadata;

export enum AgentStatus {
  Draft = "draft",
  Active = "active",
  Paused = "paused",
  Archived = "archived",
}

export enum TaskStatus {
  Pending = "pending",
  Planning = "planning",
  Planned = "planned",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export enum TaskPriority {
  Low = "low",
  Normal = "normal",
  High = "high",
  Urgent = "urgent",
}

export enum MissionStatus {
  Draft = "draft",
  Active = "active",
  Paused = "paused",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  Archived = "archived",
}

export enum MissionPriority {
  Low = "low",
  Normal = "normal",
  High = "high",
  Urgent = "urgent",
}

export enum PlanStatus {
  Draft = "draft",
  Ready = "ready",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export enum PlanStepStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Skipped = "skipped",
  Cancelled = "cancelled",
}

export enum PlanStepType {
  Reason = "reason",
  UseTool = "use_tool",
  AskUser = "ask_user",
  Transform = "transform",
  Validate = "validate",
  Respond = "respond",
}

export enum ToolCategory {
  Communication = "communication",
  Research = "research",
  Payments = "payments",
  Community = "community",
  Productivity = "productivity",
  Data = "data",
  System = "system",
  Custom = "custom",
}

export enum CapabilityCategory {
  Messaging = "messaging",
  Community = "community",
  Payments = "payments",
  Search = "search",
  Scheduling = "scheduling",
  Storage = "storage",
  Analytics = "analytics",
  Research = "research",
  Communication = "communication",
  Notifications = "notifications",
  Custom = "custom",
}

export enum ResourceType {
  Community = "community",
  Email = "email",
  Member = "member",
  Message = "message",
  Document = "document",
  Spreadsheet = "spreadsheet",
  Image = "image",
  PDF = "pdf",
  Transaction = "transaction",
  CalendarEvent = "calendar_event",
  Repository = "repository",
  Thread = "thread",
  Channel = "channel",
  DatabaseRecord = "database_record",
  Custom = "custom",
}

export enum ToolPermissionLevel {
  Read = "read",
  Write = "write",
  Admin = "admin",
  External = "external",
}

export enum ToolVisibility {
  Public = "public",
  Private = "private",
  Internal = "internal",
}

export enum ConnectorVisibility {
  Public = "public",
  Private = "private",
  Internal = "internal",
}

export enum ConnectorStatus {
  Draft = "draft",
  Active = "active",
  Disabled = "disabled",
  Error = "error",
}

export enum ConnectorAuthType {
  None = "none",
  ApiKey = "api_key",
  OAuth2 = "oauth2",
  Basic = "basic",
  Custom = "custom",
}

export enum ConnectorRiskLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum ConnectorTrustLevel {
  Unknown = "unknown",
  Local = "local",
  Remote = "remote",
  Community = "community",
  Verified = "verified",
  Official = "official",
}

export enum ConnectorPermission {
  ReadFiles = "read_files",
  WriteFiles = "write_files",
  NetworkAccess = "network_access",
  ExternalAPI = "external_api",
  EnvironmentVariables = "environment_variables",
  ExecuteCommands = "execute_commands",
  SecretsAccess = "secrets_access",
}

export enum SecurityPolicyDecisionType {
  Allow = "allow",
  Deny = "deny",
  RequiresApproval = "requires_approval",
}

export enum ModelFinishReason {
  Stop = "stop",
  Length = "length",
  Error = "error",
  Unknown = "unknown",
}

export const ModelProviderCapability = {
  TextGeneration: "text-generation",
  Reasoning: "reasoning",
  LongContext: "long-context",
  Embeddings: "embeddings",
  Multimodal: "multimodal",
  StructuredOutput: "structured-output",
} as const;

export type ModelProviderCapability =
  (typeof ModelProviderCapability)[keyof typeof ModelProviderCapability] | (string & {});

export enum MemoryType {
  Fact = "fact",
  Preference = "preference",
  Summary = "summary",
  Event = "event",
  Document = "document",
  Custom = "custom",
}

export enum MemoryScope {
  User = "user",
  Organization = "organization",
  Agent = "agent",
  Task = "task",
  Mission = "mission",
  Project = "project",
  Global = "global",
}

export enum ResultStatus {
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  Partial = "partial",
}

export enum ExecutionEventType {
  MissionStarted = "mission_started",
  MissionCompleted = "mission_completed",
  MissionCancelled = "mission_cancelled",
  TaskCreated = "task_created",
  TaskReceived = "task_received",
  TaskStarted = "task_started",
  TaskCompleted = "task_completed",
  TaskFailed = "task_failed",
  PlanningStarted = "planning_started",
  PlanGenerated = "plan_generated",
  PlanStarted = "plan_started",
  PlanningCompleted = "planning_completed",
  StepStarted = "step_started",
  ToolRequested = "tool_requested",
  ToolResolved = "tool_resolved",
  ToolStarted = "tool_started",
  ToolCalled = "tool_called",
  ToolExecuted = "tool_executed",
  ToolCompleted = "tool_completed",
  ToolFailed = "tool_failed",
  MemoryRead = "memory_read",
  MemoryWrite = "memory_write",
  MemoryWritten = "memory_written",
  StepCompleted = "step_completed",
  StepFailed = "step_failed",
  ConnectorConnected = "connector_connected",
  ConnectorFailed = "connector_failed",
  ResultCreated = "result_created",
}

export enum PlannerStrategyType {
  RuleBased = "rule_based",
  LLM = "llm",
  Hybrid = "hybrid",
  Custom = "custom",
}

export enum ConnectorHealthStatus {
  Healthy = "healthy",
  Degraded = "degraded",
  Unhealthy = "unhealthy",
  Unknown = "unknown",
}

export interface MissionOwner {
  id: string;
  type: "user" | "organization" | "team" | "system";
  name?: string;
  metadata?: AgentOSMetadata;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  objective: string;
  status: MissionStatus;
  priority: MissionPriority;
  owner: MissionOwner;
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  metadata?: MissionMetadata;
}

export interface AgentCapability {
  name: string;
  description?: string;
  metadata?: AgentOSMetadata;
}

export interface AgentPermission {
  resource: string;
  level: ToolPermissionLevel;
  metadata?: AgentOSMetadata;
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  supportedConnectors: string[];
  metadata?: CapabilityMetadata;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  status?: AgentStatus;
  capabilities: AgentCapability[];
  tools: Tool[];
  memoryPolicy: MemoryPolicy;
  permissions: AgentPermission[];
  metadata?: AgentOSMetadata;
}

export interface TaskSource {
  type: string;
  name?: string;
  userId?: string;
  organizationId?: string;
  metadata?: AgentOSMetadata;
}

export interface Task {
  id: string;
  input: unknown;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  createdAt: Date;
  updatedAt: Date;
  metadata?: AgentOSMetadata;
}

export interface Plan {
  id: string;
  taskId: string;
  steps: PlanStep[];
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: AgentOSMetadata;
}

export interface PlanStep {
  id: string;
  order: number;
  type: PlanStepType;
  description: string;
  requiredTool?: string;
  status: PlanStepStatus;
  input?: unknown;
  output?: unknown;
  error?: AgentOSError;
  metadata?: AgentOSMetadata;
}

export interface ToolExecutionResult<Output = unknown> {
  success: boolean;
  output?: Output;
  metadata?: AgentOSMetadata;
  durationMs: number;
  errors: AgentOSError[];
}

export interface ToolAuthor {
  name: string;
  email?: string;
  url?: string;
  metadata?: AgentOSMetadata;
}

export interface ToolExample<Input = unknown, Output = unknown> {
  title: string;
  input?: Input;
  output?: Output;
  description?: string;
  metadata?: AgentOSMetadata;
}

export interface ModelGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: AgentOSMetadata;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  metadata?: AgentOSMetadata;
}

export interface ModelGenerationResponse {
  text: string;
  usage?: ModelUsage;
  metadata?: AgentOSMetadata;
  finishReason?: ModelFinishReason | string;
  provider?: string;
  model?: string;
  durationMs?: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: ToolAuthor;
  tags?: string[];
  metadata?: AgentOSMetadata;
  capabilities: ModelProviderCapability[];
  generate(
    request: ModelGenerationRequest
  ): Promise<ModelGenerationResponse> | ModelGenerationResponse;
}

export interface Tool<Input = unknown, Output = unknown> {
  id: string;
  name: string;
  description: string;
  version?: string;
  capability: string;
  category: ToolCategory;
  author?: ToolAuthor;
  tags?: string[];
  examples?: ToolExample<Input, Output>[];
  permissions?: AgentPermission[];
  visibility?: ToolVisibility;
  inputSchema: AgentOSJSONSchema;
  outputSchema: AgentOSJSONSchema;
  permissionLevel: ToolPermissionLevel;
  metadata?: AgentOSMetadata;
  execute: (
    input: Input,
    context: ExecutionContext
  ) => Promise<ToolExecutionResult<Output>> | ToolExecutionResult<Output>;
}

export interface RegisteredTool<Input = unknown, Output = unknown> extends Tool<Input, Output> {
  capabilityIds: string[];
  connectorId?: string;
  metadata?: AgentOSMetadata;
}

export interface Connector {
  id: string;
  name: string;
  provider: string;
  tools: Tool[];
  authType: ConnectorAuthType;
  status: ConnectorStatus;
  metadata?: AgentOSMetadata;
}

export interface ResourceReference {
  id: string;
  type: ResourceType;
  source: string;
  uri?: string;
  metadata?: ResourceMetadata;
}

export interface Resource {
  id: string;
  type: ResourceType;
  source: string;
  uri?: string;
  metadata?: ResourceMetadata;
}

export interface RegistryOperationResult<T> {
  success: boolean;
  item?: T;
  error?: AgentOSError;
  metadata?: AgentOSMetadata;
}

export interface RegistrySummary {
  capabilities: number;
  connectors: number;
  tools: number;
  resources: number;
  modelProviders?: number;
  metadata?: AgentOSMetadata;
}

export interface RegistryValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  entityType: "capability" | "connector" | "tool" | "resource" | "model_provider";
  entityId?: string;
  metadata?: AgentOSMetadata;
}

export interface RegistryValidationResult {
  valid: boolean;
  issues: RegistryValidationIssue[];
  summary: RegistrySummary;
  metadata?: AgentOSMetadata;
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  scope: MemoryScopeReference;
  content: unknown;
  ownerId?: string;
  taskId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: AgentOSMetadata;
}

export interface MemoryScopeReference {
  type: MemoryScope;
  id?: string;
}

export interface MemoryPolicy {
  enabled: boolean;
  scopes: MemoryScope[];
  readableTypes: MemoryType[];
  writableTypes: MemoryType[];
  retentionDays?: number;
  metadata?: AgentOSMetadata;
}

export interface MemoryQuery {
  text?: string;
  query?: string;
  types?: MemoryType[];
  scopes?: MemoryScope[];
  scope?: MemoryScopeReference;
  ownerId?: string;
  taskId?: string;
  limit?: number;
  metadata?: AgentOSMetadata;
}

export interface UserContext {
  id: string;
  name?: string;
  email?: string;
  metadata?: AgentOSMetadata;
}

export interface OrganizationContext {
  id: string;
  name: string;
  metadata?: AgentOSMetadata;
}

export interface ExecutionContext {
  agent: Agent;
  task: Task;
  plan?: Plan;
  memory: MemoryRecord[];
  resources?: Resource[];
  variables: AgentOSVariables;
  environment: AgentOSEnvironment;
  user?: UserContext;
  organization?: OrganizationContext;
  metadata?: AgentOSMetadata;
}

export interface PlannerOptions {
  strategy?: PlannerStrategyType | string;
  maxSteps?: number;
  timeoutMs?: number;
  metadata?: AgentOSMetadata;
}

export interface PlannerProviderRequest {
  providerId?: string;
  requiredCapabilities?: ModelProviderCapability[];
  preferredCapabilities?: ModelProviderCapability[];
  allowDefaultProvider?: boolean;
  metadata?: AgentOSMetadata;
}

export type ModelAssistedPlannerFallback = "rule-based" | "fail";

export interface ModelAssistedPlannerOptions extends PlannerOptions {
  provider?: PlannerProviderRequest;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  fallback?: ModelAssistedPlannerFallback;
  includeRawResponse?: boolean;
  metadata?: AgentOSMetadata;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: AgentOSError[];
  warnings: string[];
  metadata?: AgentOSMetadata;
}

export interface PlanComplexityEstimate {
  score: number;
  level: "low" | "medium" | "high" | "unknown";
  estimatedSteps?: number;
  estimatedDurationMs?: number;
  metadata?: AgentOSMetadata;
}

export interface Planner {
  id: string;
  name: string;
  strategy: PlannerStrategy;
  plan(
    agent: Agent,
    task: Task,
    context: ExecutionContext,
    options?: PlannerOptions
  ): Promise<Plan> | Plan;
  replan(
    agent: Agent,
    task: Task,
    context: ExecutionContext,
    previousPlan: Plan,
    options?: PlannerOptions
  ): Promise<Plan> | Plan;
  validatePlan(plan: Plan): Promise<PlanValidationResult> | PlanValidationResult;
  estimateComplexity(
    task: Task,
    options?: PlannerOptions
  ): Promise<PlanComplexityEstimate> | PlanComplexityEstimate;
}

export interface PlannerStrategy {
  id: string;
  name: string;
  type: PlannerStrategyType;
  description?: string;
  metadata?: AgentOSMetadata;
}

export interface RuleBasedPlannerStrategy extends PlannerStrategy {
  type: PlannerStrategyType.RuleBased;
}

export interface LLMPlannerStrategy extends PlannerStrategy {
  type: PlannerStrategyType.LLM;
  provider?: string;
  model?: string;
}

export interface HybridPlannerStrategy extends PlannerStrategy {
  type: PlannerStrategyType.Hybrid;
  strategies: PlannerStrategy[];
}

export interface ExecutionOptions {
  timeoutMs?: number;
  dryRun?: boolean;
  toolResolver?: ToolResolver;
  metadata?: AgentOSMetadata;
}

export interface ExecutionControlRequest {
  executionId: string;
  reason?: string;
  metadata?: AgentOSMetadata;
}

export interface ExecutionControlResult {
  executionId: string;
  accepted: boolean;
  status: "paused" | "resumed" | "cancelled" | "retry_requested";
  message: string;
  metadata?: AgentOSMetadata;
}

export interface ExecutionEngine {
  id: string;
  name: string;
  executePlan(
    agent: Agent,
    task: Task,
    plan: Plan,
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Promise<Result> | Result;
  executeStep(
    agent: Agent,
    task: Task,
    plan: Plan,
    step: PlanStep,
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Promise<PlanStep> | PlanStep;
  pause(executionId: string): Promise<ExecutionControlResult> | ExecutionControlResult;
  resume(executionId: string): Promise<ExecutionControlResult> | ExecutionControlResult;
  cancel(executionId: string): Promise<ExecutionControlResult> | ExecutionControlResult;
  retry(executionId: string): Promise<ExecutionControlResult> | ExecutionControlResult;
}

export interface CapabilityRegistry {
  registerCapability(capability: Capability): Promise<Capability> | Capability;
  unregisterCapability(capabilityId: string): Promise<void> | void;
  listCapabilities(): Promise<Capability[]> | Capability[];
  findCapability(
    capabilityIdOrName: string
  ): Promise<Capability | undefined> | Capability | undefined;
}

export interface ResourceRegistry {
  registerResource(resource: Resource): Promise<Resource> | Resource;
  resolveResource(
    reference: ResourceReference
  ): Promise<Resource | undefined> | Resource | undefined;
  listResources(filter?: ResourceRegistryFilter): Promise<Resource[]> | Resource[];
}

export interface ResourceRegistryFilter {
  type?: ResourceType;
  source?: string;
  metadata?: AgentOSMetadata;
}

export interface ConnectorVersion {
  current: string;
  minimumAgentOSVersion?: string;
  metadata?: AgentOSMetadata;
}

export interface ConnectorCapabilities {
  capabilities: Capability[];
  tools: RegisteredTool[];
  resources?: ResourceType[];
  metadata?: AgentOSMetadata;
}

export interface ConnectorProvider {
  id: string;
  name: string;
  displayName?: string;
  websiteUrl?: string;
  metadata?: AgentOSMetadata;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  provider: ConnectorProvider;
  version: ConnectorVersion;
  capabilities: ConnectorCapabilities;
  authType: ConnectorAuthType;
  security?: ConnectorSecurityProfile;
  metadata?: AgentOSMetadata;
}

export interface ConnectorSecurityProfile {
  riskLevel: ConnectorRiskLevel;
  trustLevel?: ConnectorTrustLevel;
  permissions: ConnectorPermission[];
  requiresUserApproval: boolean;
  networkAccess: boolean;
  filesystemAccess: boolean;
  secretsAccess: boolean;
  metadata?: AgentOSMetadata;
}

export interface ConnectorSecurityPolicy {
  allowedRiskLevels?: ConnectorRiskLevel[];
  deniedPermissions?: ConnectorPermission[];
  requireApprovalFor?: ConnectorPermission[];
  allowNetworkAccess?: boolean;
  allowFilesystemAccess?: boolean;
  allowSecretsAccess?: boolean;
  metadata?: AgentOSMetadata;
}

export interface SecurityPolicyConfig {
  maximumRiskLevel?: ConnectorRiskLevel;
  allowedPermissions?: ConnectorPermission[];
  deniedPermissions?: ConnectorPermission[];
  allowFilesystemConnectors?: boolean;
  allowNetworkConnectors?: boolean;
  allowSecretsAccess?: boolean;
  requireApprovalAboveRiskLevel?: ConnectorRiskLevel;
  requireApprovalForPermissions?: ConnectorPermission[];
  metadata?: AgentOSMetadata;
}

export interface SecurityPolicyDecision {
  decision: SecurityPolicyDecisionType;
  reasons: string[];
  warnings: string[];
  matchedRules: string[];
  metadata?: AgentOSMetadata;
}

export interface ConnectorHealth {
  connectorId: string;
  status: ConnectorHealthStatus;
  checkedAt: Date;
  message?: string;
  metadata?: AgentOSMetadata;
}

export interface ConnectorRegistry {
  registerConnector(manifest: ConnectorManifest): Promise<ConnectorManifest> | ConnectorManifest;
  unregisterConnector(connectorId: string): Promise<void> | void;
  listConnectors(): Promise<ConnectorManifest[]> | ConnectorManifest[];
  findConnector(
    connectorIdOrProvider: string
  ): Promise<ConnectorManifest | undefined> | ConnectorManifest | undefined;
  getConnectorHealth(connectorId: string): Promise<ConnectorHealth> | ConnectorHealth;
}

export interface ToolResolutionRequest {
  capability?: string;
  capabilityId?: string;
  toolId?: string;
  stepType?: PlanStepType;
  step?: PlanStep;
  task?: Task;
  metadata?: AgentOSMetadata;
}

export interface ToolResolutionResult {
  success: boolean;
  tool?: RegisteredTool;
  reason?: string;
  errors: AgentOSError[];
  metadata?: AgentOSMetadata;
}

export interface ToolResolver {
  resolve(request: ToolResolutionRequest): ToolResolutionResult;
}

export interface ModelProviderResolutionRequest {
  providerId?: string;
  capability?: string;
  useDefault?: boolean;
  metadata?: AgentOSMetadata;
}

export interface ModelProviderResolutionResult {
  success: boolean;
  provider?: ModelProvider;
  reason?: string;
  errors: AgentOSError[];
  metadata?: AgentOSMetadata;
}

export interface ModelProviderResolver {
  resolve(request?: ModelProviderResolutionRequest): ModelProviderResolutionResult;
}

export interface ToolCallRecord {
  id: string;
  toolId?: string;
  toolName: string;
  stepId?: string;
  input?: unknown;
  output?: unknown;
  success?: boolean;
  error?: AgentOSError;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  metadata?: AgentOSMetadata;
}

export interface AgentOSError {
  code: string;
  message: string;
  details?: unknown;
  recoverable?: boolean;
  metadata?: AgentOSMetadata;
}

export interface ExecutionTrace {
  stepId?: string;
  event: ExecutionEventType;
  timestamp: Date;
  input?: unknown;
  output?: unknown;
  error?: AgentOSError;
  metadata?: AgentOSMetadata;
}

export interface BaseExecutionEvent {
  id: string;
  type: ExecutionEventType;
  timestamp: Date;
  taskId?: string;
  missionId?: string;
  stepId?: string;
  metadata?: AgentOSMetadata;
}

export interface MissionExecutionEvent extends BaseExecutionEvent {
  type:
    | ExecutionEventType.MissionStarted
    | ExecutionEventType.MissionCompleted
    | ExecutionEventType.MissionCancelled;
  missionId: string;
  mission?: Mission;
}

export interface TaskExecutionEvent extends BaseExecutionEvent {
  type:
    | ExecutionEventType.TaskCreated
    | ExecutionEventType.TaskReceived
    | ExecutionEventType.TaskStarted
    | ExecutionEventType.TaskCompleted
    | ExecutionEventType.TaskFailed;
  taskId: string;
  task?: Task;
  error?: AgentOSError;
}

export interface PlanExecutionEvent extends BaseExecutionEvent {
  type:
    | ExecutionEventType.PlanningStarted
    | ExecutionEventType.PlanGenerated
    | ExecutionEventType.PlanStarted
    | ExecutionEventType.PlanningCompleted;
  taskId: string;
  plan?: Plan;
  error?: AgentOSError;
}

export interface StepExecutionEvent extends BaseExecutionEvent {
  type:
    | ExecutionEventType.StepStarted
    | ExecutionEventType.StepCompleted
    | ExecutionEventType.StepFailed;
  taskId: string;
  stepId: string;
  step?: PlanStep;
  error?: AgentOSError;
}

export interface ToolExecutionEvent extends BaseExecutionEvent {
  type:
    | ExecutionEventType.ToolRequested
    | ExecutionEventType.ToolResolved
    | ExecutionEventType.ToolStarted
    | ExecutionEventType.ToolCalled
    | ExecutionEventType.ToolExecuted
    | ExecutionEventType.ToolCompleted
    | ExecutionEventType.ToolFailed;
  taskId: string;
  toolName: string;
  toolCall?: ToolCallRecord;
  error?: AgentOSError;
}

export interface MemoryExecutionEvent extends BaseExecutionEvent {
  type:
    | ExecutionEventType.MemoryRead
    | ExecutionEventType.MemoryWrite
    | ExecutionEventType.MemoryWritten;
  taskId?: string;
  memory?: MemoryRecord | MemoryRecord[];
  query?: MemoryQuery;
  error?: AgentOSError;
}

export interface ConnectorExecutionEvent extends BaseExecutionEvent {
  type: ExecutionEventType.ConnectorConnected | ExecutionEventType.ConnectorFailed;
  connectorId: string;
  connector?: ConnectorManifest;
  health?: ConnectorHealth;
  error?: AgentOSError;
}

export interface ResultExecutionEvent extends BaseExecutionEvent {
  type: ExecutionEventType.ResultCreated;
  taskId: string;
  result?: Result;
}

export type ExecutionEvent =
  | MissionExecutionEvent
  | TaskExecutionEvent
  | PlanExecutionEvent
  | StepExecutionEvent
  | ToolExecutionEvent
  | MemoryExecutionEvent
  | ConnectorExecutionEvent
  | ResultExecutionEvent;

export interface Result {
  taskId: string;
  status: ResultStatus;
  answer?: unknown;
  plan?: Plan;
  trace: ExecutionTrace[];
  toolCalls: ToolCallRecord[];
  memoryWrites: MemoryRecord[];
  errors: AgentOSError[];
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  metadata?: AgentOSMetadata;
}
