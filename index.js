const fs = require('fs');
const path = require('path');
const configPath = path.resolve(__dirname, './config');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const workers = config.workers;
const host = config.host;
const cycle_time_sec = config.cycle_time_sec;
const DKGClient = require("dkg.js");

const node_options = {
  environment: "testnet",
  endpoint: host,
  port: "8900",
  useSSL: false,
  maxNumberOfRetries: 100,
};

const dkg = new DKGClient(node_options);

// Function to start creating pending uploads for each blockchain
async function start() {
  try {
    // Keep starting the process every 10 seconds
    setTimeout(async () => {
      await start();
    }, cycle_time_sec * 1000);

    // Create asset for each worker concurrently
    for (const worker of workers) {
      console.log(`${worker.name} wallet ${worker.public_key}: Creating next asset on base:84532.`);
      
      // Set options for each worker
      let dkg_options = {
        environment: "testnet",
        epochsNum: 1,
        maxNumberOfRetries: 30,
        frequency: 2,
        contentType: "all",
        blockchain: {
          name: "base:84532",
          publicKey: worker.public_key,
          privateKey: worker.private_key,
          handleNotMinedError: true,
        },
      };

      let data_obj = {
        public: {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          "name": "asset",
          "description": "asset description",
        }
      };

      // Create the asset asynchronously without waiting for completion
      dkg.asset.create(data_obj, dkg_options)
        .then((result) => {
          console.log(`${worker.name} wallet ${worker.public_key}: Created UAL: ${result.UAL}.`);
        })
        .catch((error) => {
          console.error(`${worker.name} wallet ${worker.public_key}: Error creating asset:`, error);
        });
    }
  } catch (error) {
    console.error("Error publishing dataset:", error);
  }
}

start();
