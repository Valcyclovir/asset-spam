const fs = require("fs");
const path = require("path");
const { setTimeout } = require("timers/promises");

const configPath = path.resolve(__dirname, "config");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const { workers, host, cycle_time_sec } = config;
const DKGClient = require("dkg.js");
const wordPool = require("./util/words");

const node_options = {
  environment: "testnet",
  endpoint: host,
  port: "8900",
  useSSL: false,
  maxNumberOfRetries: 100,
};

const dkg = new DKGClient(node_options);

function randomWords(words) {
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
}

async function createWorkerAsset(worker) {
  const dkg_options = {
    ...node_options,
    epochsNum: 1,
    maxNumberOfRetries: 30,
    frequency: 2,
    contentType: "all",
    state: "LATEST_FINALIZED",
    validate: true,
    blockchain: {
      name: "base:84532",
      publicKey: worker.public_key,
      privateKey: worker.private_key,
      handleNotMinedError: true,
    },
  };

  const data_obj = {
    public: {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: "asset",
      description: "asset description",
    },
  };

  try {
    const result = await dkg.asset.create(data_obj, dkg_options);
    await dkg.asset.get(result.UAL, dkg_options);

    let topic = await randomWords(wordPool);

    let query = `PREFIX schema: <http://schema.org/>

          SELECT ?subject (SAMPLE(?name) AS ?name) (SAMPLE(?description) AS ?description) 
                 (REPLACE(STR(?g), "^assertion:", "") AS ?assertion)
          WHERE {
            GRAPH ?g {
              ?subject schema:name ?name .
              ?subject schema:description ?description .
              
              FILTER(
                (isLiteral(?name) && CONTAINS(str(?name), "${topic}")) || (isLiteral(?name) && CONTAINS(LCASE(str(?name)), "${topic}")) ||
                (isLiteral(?description) && CONTAINS(str(?description), "${topic}")) || (isLiteral(?description) && CONTAINS(LCASE(str(?description)), "${topic}"))
              )
            }
            ?ual schema:assertion ?g .
            FILTER(CONTAINS(str(?ual), "base:84532"))
          }
          GROUP BY ?subject ?g
          LIMIT 100  
          `;

    await dkg.graph.query(query, "SELECT", { graphState: "CURRENT" });
    
    console.log(
      `${worker.name} wallet ${worker.public_key}: Created UAL: ${result.UAL}.`
    );
    return result.UAL;
  } catch (error) {
    console.error(
      `${worker.name} wallet ${worker.public_key}: Error creating asset:`,
      error
    );
    return null;
  }
}

async function processWorkers() {
  await Promise.all(
    workers.map(async (worker) => {
      console.log(
        `${worker.name} wallet ${worker.public_key}: Starting asset creation.`
      );
      return createWorkerAsset(worker);
    })
  );
}

/**
 * Main function to cycle through the worker processes.
 */
async function start() {
  try {
    await processWorkers();
    // Here's where the correction is made. Ensure you're passing a number for delay:
    await setTimeout(cycle_time_sec * 1000); // Wait for cycle_time_sec before starting again
    start(); // Directly call start to schedule the next cycle
  } catch (error) {
    console.error("Error in start function:", error);
    await setTimeout(cycle_time_sec * 1000); // Schedule next run even if an error occurred
    start(); // Retry starting the process
  }
}

// Start the process
start();
