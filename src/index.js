import {
  EC2Client,
  DescribeInstancesCommand,
  paginateDescribeInstances,
  StopInstancesCommand,
  StartInstancesCommand,
} from "@aws-sdk/client-ec2";

import loggerFactory from "./logger";

const logger = loggerFactory.getLogger("main");

const region = process.env.REGION;
const client = new EC2Client({ region });

const getInstances = async (input) => {
  const paginator = paginateDescribeInstances(
    {
      client,
      pageSize: 20,
    },
    input,
    {}
  );

  const instances = [];
  for await (const page of paginator) {
    const { Reservations } = page;
    for (const reservation of Reservations) {
      const { Instances } = reservation;
      Instances.forEach((i) => {
        const { InstanceId, Tags, State } = i;
        const tags = Tags.reduce((obj, t) => {
          const { Key, Value } = t;
          obj[Key] = Value;
          return obj;
        }, {});
        instances.push({ InstanceId, Tags: tags, State });
      });
    }
  }
  return instances;
};

const stopInstances = async (instances) => {
  const stopInstancesCommand = new StopInstancesCommand({
    InstanceIds: instances
      .filter((i) => i.State.Name === "running")
      .map((i) => i.InstanceId),
  });

  const { StoppingInstances } = await client.send(stopInstancesCommand);
  logger.info(`Instances status: ${JSON.stringify(StoppingInstances)}`);
};

const startInstances = async (instances) => {
  const startInstancesCommand = new StartInstancesCommand({
    InstanceIds: instances
      .filter((i) => i.State.Name === "stopped")
      .map((i) => i.InstanceId),
  });

  const { StartingInstances } = await client.send(startInstancesCommand);
  logger.info(`Instances status: ${JSON.stringify(StartingInstances)}`);
};

export const lifecycle = async (event) => {
  const { action, filters } = event;

  logger.info(`Action: ${action} - Filters: ${JSON.stringify(filters)}`);

  const instances = await getInstances({
    Filters: filters,
  });

  logger.info(`EC2 instances: ${JSON.stringify(instances)}`);
  if (action === "stop") {
    await stopInstances(instances);
  } else if (action === "start") {
    await startInstances(instances);
  } else {
    logger.warn("No defined action. Valid values: (start|stop)");
  }
};
