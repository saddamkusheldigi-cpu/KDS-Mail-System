import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || "InboxMailerWorker";
const REGION = process.env.AWS_REGION || "ap-south-1";

console.log("==========================================");
console.log(`📦 PACKAGING & DEPLOYING WORKER TO AWS LAMBDA`);
console.log(`Function: ${FUNCTION_NAME}`);
console.log(`Region:   ${REGION}`);
console.log("==========================================\n");

const zipPath = path.join(__dirname, "function.zip");

// Remove old zip if exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  console.log("1️⃣ Creating deployment zip bundle...");
  const isWindows = process.platform === "win32";

  if (isWindows) {
    // PowerShell Compress-Archive
    const srcDir = path.join(__dirname, "src");
    const pkgJson = path.join(__dirname, "package.json");
    execSync(
      `powershell -Command "Compress-Archive -Path '${srcDir}', '${pkgJson}' -DestinationPath '${zipPath}'"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`zip -r function.zip src package.json`, { cwd: __dirname, stdio: "inherit" });
  }

  console.log(`\n2️⃣ Uploading function.zip to AWS Lambda (${FUNCTION_NAME})...`);
  const deployCmd = `aws lambda update-function-code --region ${REGION} --function-name ${FUNCTION_NAME} --zip-file fileb://${zipPath}`;
  
  execSync(deployCmd, { stdio: "inherit" });
  console.log("\n🎉 Lambda worker updated successfully!");
} catch (err) {
  console.error("\n❌ Deployment failed:", err.message);
  console.log("\n💡 Note: Make sure AWS CLI is configured with credentials and the Lambda function exists.");
}
