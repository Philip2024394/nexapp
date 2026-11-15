// QA · C4 · payment resolver probe · tsx runner
import {
  getSellerActiveMethods,
  getSellerMethodReadiness,
} from "../../../src/lib/nex-native/payments/method-resolver-service";

async function main() {
  const bizId = "099b2fca-dbaf-4a09-aa28-a2433a7b70fd"; // CK5 A biz
  const active = await getSellerActiveMethods(bizId);
  const readiness = await getSellerMethodReadiness(bizId);
  console.log(JSON.stringify({ businessId: bizId, active, readiness }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("resolver probe failed:", e);
  process.exit(1);
});
