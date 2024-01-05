import * as dotenv from "dotenv";
import chalk from "chalk";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function getABI(contractAddress: string, fileName: string) {
  const response = await axios.get(
    `https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=${process.env.ETHERSCAN_API_KEY}`
  );

  console.log("response", response.data);

  if (response.data.result) {
    const result: string = response.data.result;
    console.log("result", result);
    const abi = JSON.parse(result);

    // moves back one folder i.e. "../abis"
    const folderPath = path.join(__dirname, "../", "abis");

    // Check if the folder exists, if not, create the folder
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const filePath = path.join(folderPath, fileName + ".json");

    // Write the JSON object to a file
    fs.writeFileSync(filePath, JSON.stringify(abi, null, 4), "utf-8");
    console.log("ABI has been written to contractABI.json");
  } else {
    console.log(chalk.red("Error in fetching ABI"));
    console.log(response.data);
  }
}

const contractAddress = process.argv[2];
const fileName = process.argv[3];

async function main() {
  if (!contractAddress) {
    console.log(chalk.red("Contract address is missing"));
    return;
  }

  if (!fileName) {
    console.log(chalk.red("File name is missing"));
    return;
  }

  await getABI(contractAddress, fileName);
}

main();
