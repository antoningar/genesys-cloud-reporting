import * as platformClient from "purecloud-platform-client-v2";

interface EventInput {
  interval?: string;
  maxDuration?: number;
}

interface ContextInput {
  clientContext: {
    gc_client_id: string;
    gc_client_secret: string;
    gc_aws_region: string;
  };
}

interface ConversationFilter {
  type: string;
  predicates: Array<{
    metric: string;
    operator?: string;
    range?: {
      gte: number;
      lte: number;
    };
  }>;
}

interface ConversationBody {
  conversationFilters: ConversationFilter[];
  interval: string;
}

interface ActionFilter {
  type: string;
  clauses?: Array<{
    type: string;
    predicates: Array<{
      dimension: string;
      operator: string;
    }>;
  }>;
}

interface ActionBody {
  filter: ActionFilter;
  metrics: string[];
  groupBy: string[];
  interval: string;
}

interface SegmentFilter {
  type: string;
  predicates: Array<{
    type: string;
    dimension: string;
    value: string;
  }>;
}

interface FlowErrorBody {
  segmentFilters: SegmentFilter[];
  interval: string;
}

interface AggregateData {
  group?: { [key: string]: string };
  data?: Array<{
    metrics?: Array<{
      stats?: {
        count?: number;
      };
    }>;
  }>;
}

interface AggregateResult {
  results?: AggregateData[];
}

interface ClearedAggregate {
  actionId: string;
  responseStatus: string;
  errorType: string;
  count: number;
}

interface ConversationResult {
  conversations?: Array<{
    conversationId?: string;
  }>;
}

interface ClearedConversations {
  conversations: string[];
  total: number;
}

interface HandlerResult {
  shortConversations: ClearedConversations;
  flowErrors: ClearedConversations;
  dataActionErrors: ClearedAggregate[];
}

function setLogger(client: any): void {
  client.config.logger.log_level =
    client.config.logger.logLevelEnum.level.LTrace;
  client.config.logger.log_format =
    client.config.logger.logFormatEnum.formats.LTrace;
  client.config.logger.log_request_body = true;
  client.config.logger.log_response_body = true;
  client.config.logger.log_to_console = true;

  client.config.logger.setLogger();
}

function getYesterdayInterval(): string {
  const now = new Date();

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setUTCDate(now.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  // Get the end of yesterday (23:59:59.999 UTC)
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setUTCHours(23, 59, 59, 999);

  // Format as ISO 8601
  const startISO = yesterday.toISOString();
  const endISO = endOfYesterday.toISOString();

  return `${startISO}/${endISO}`;
}

function getInterval(event: EventInput): [string, number] {
  let interval = event.interval;
  let maxDuration = event.maxDuration;

  maxDuration ??= 1000;
  interval ??= getYesterdayInterval();

  return [interval, maxDuration];
}

function getContextParams(context: ContextInput): [string, string, string] {
  const clientContext = context.clientContext;
  const clientId = clientContext.gc_client_id;
  const clientSecret = clientContext.gc_client_secret;
  const region = clientContext.gc_aws_region;

  if (!clientId || !clientSecret || !region) {
    throw new Error("input missing");
  }

  return [clientId, clientSecret, region];
}

function buildShortConversationBody(interval: string, maxDuration: number): ConversationBody {
  return {
    conversationFilters: [
      {
        type: "and",
        predicates: [
          {
            metric: "tConversationDuration",
            operator: "exists",
          },
          {
            metric: "tConversationDuration",
            range: {
              gte: 0,
              lte: maxDuration,
            },
          },
        ],
      },
    ],
    interval: interval,
  };
}

async function getShortConversations(interval: string, maxDuration: number): Promise<ClearedConversations> {
  const body = buildShortConversationBody(interval, maxDuration);
  const conversations = await getConversations(body);
  const clearedConversations = clearConversations(conversations);
  return clearedConversations;
}

function buildActionBody(interval: string): ActionBody {
  return {
    filter: {
      type: "and",
      clauses: [
        {
          type: "or",
          predicates: [
            {
              dimension: "actionId",
              operator: "exists",
            },
          ],
        },
      ],
    },
    metrics: ["tTotalExecution"],
    groupBy: ["actionId", "errorType", "responseStatus"],
    interval: interval,
  };
}

function clearAggregates(datas: AggregateResult): ClearedAggregate[] {
  const clearedAggregates: ClearedAggregate[] = [];

  datas?.results?.forEach((aggregate) => {
    const clearedAggregate = clearAggregate(aggregate);
    if (clearedAggregate) {
        clearedAggregates.push(clearedAggregate);
    }
  });

  return clearedAggregates;
}

function clearAggregate(aggregate: AggregateData): ClearedAggregate | undefined {
  if (!aggregate.group || !aggregate.data?.[0]?.metrics?.[0]?.stats) {
    return;
  }
  
  const errorType = aggregate.group.errorType;
  if (errorType === "NONE") {
    return;
  }

  const responseStatus = aggregate.group.responseStatus;
  const actionId = aggregate.group.actionId;
  const count = aggregate.data[0].metrics[0].stats.count;
  
  if (!actionId || !responseStatus || !errorType || count === undefined) {
    return;
  }
  
  return {
    actionId: actionId,
    responseStatus: responseStatus,
    errorType: errorType,
    count: count,
  };
}

async function getAggregates(body: ActionBody): Promise<AggregateResult> {
  const analyticsApi = new platformClient.AnalyticsApi();
  return await analyticsApi.postAnalyticsActionsAggregatesQuery(body);
}

async function getDataActions(interval: string): Promise<ClearedAggregate[]> {
  const body = buildActionBody(interval);
  const aggregates = await getAggregates(body);

  return clearAggregates(aggregates);
}

function buildFlowErrorBody(interval: string): FlowErrorBody {
  return {
    segmentFilters: [
      {
        type: "or",
        predicates: [
          {
            type: "dimension",
            dimension: "exitReason",
            value: "FLOW_ERROR_DISCONNECT",
          }
        ]
      }
    ],
    interval: interval,
  };
}

async function getConversations(body: ConversationBody | FlowErrorBody): Promise<ConversationResult> {
  const conversationApi = new platformClient.ConversationsApi();
  return await conversationApi.postAnalyticsConversationsDetailsQuery(body);
}

function clearConversations(datas: ConversationResult): ClearedConversations {
  const clearedConversations: string[] = [];

  datas?.conversations?.forEach((conversation) => {
    const clearedConversation = conversation.conversationId;
    if (clearedConversation) {
      clearedConversations.push(clearedConversation);
    }
  });

  return {
    conversations: clearedConversations,
    total: clearedConversations.length
  };
}

async function getFlowsErrors(interval: string): Promise<ClearedConversations> {
  const body = buildFlowErrorBody(interval);
  const conversations = await getConversations(body);

  return clearConversations(conversations);
}

export const handler = async (event: EventInput, context: ContextInput): Promise<HandlerResult | undefined> => {
  try {
    const [interval, maxDuration] = getInterval(event);
    const [clientId, clientSecret, region] = getContextParams(context);

    const client = platformClient.ApiClient.instance;
    setLogger(client);
    client.setEnvironment(platformClient.PureCloudRegionHosts[region]);
    await client.loginClientCredentialsGrant(clientId, clientSecret);

    const shortConversations = await getShortConversations(interval, maxDuration);
    const flowErrors = await getFlowsErrors(interval);
    const dataActions = await getDataActions(interval);

    return {
      shortConversations: shortConversations,
      flowErrors: flowErrors,
      dataActionErrors: dataActions
    };

  } catch (error) {
    console.log(error);
    return;
  }
};

if (require.main === module) {
  const customContext: ContextInput = {
    clientContext: {
      gc_client_id: "",
      gc_client_secret: "",
      gc_aws_region: "",
    },
  };
  const customEvent: EventInput = {
    interval: "2025-01-31T23:00:00.000Z/2025-02-28T23:00:00.000Z",
    maxDuration: 0,
  };
  handler(customEvent, customContext)
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
}