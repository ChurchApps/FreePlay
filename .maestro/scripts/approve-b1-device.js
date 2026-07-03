// Maestro runScript helper for B1Church OAuth device-flow approval via Maestro.copiedText user_code.
// Runs on host (not emulator), POST /membership/users/login and POST /membership/oauth/device/approve.

const userCode = (maestro.copiedText || "").trim();
if (!userCode) {
  throw new Error("approve-b1-device: no user_code in clipboard");
}

const apiBase = "http://localhost:8084";

const loginResp = http.post(apiBase + "/membership/users/login", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "demo@b1.church", password: "password" })
});
if (loginResp.status !== 200) {
  throw new Error("approve-b1-device: login failed " + loginResp.status + " " + loginResp.body);
}
const login = JSON.parse(loginResp.body);
// /device/approve calls actionWrapper which authenticates via any module's JWT;
// the MembershipApi-scoped JWT is the canonical one for membership endpoints.
const apis = login.userChurches[0].apis;
const membershipApi = apis.find(function (a) { return a.keyName === "MembershipApi"; });
if (!membershipApi || !membershipApi.jwt) {
  throw new Error("approve-b1-device: MembershipApi JWT not found in login response");
}
const jwt = membershipApi.jwt;

const approveResp = http.post(apiBase + "/membership/oauth/device/approve", {
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + jwt
  },
  body: JSON.stringify({ user_code: userCode, church_id: "CHU00000001" })
});
if (approveResp.status !== 200) {
  throw new Error(
    "approve-b1-device: approve failed " + approveResp.status + " body=" + approveResp.body + " code=" + userCode
  );
}
output.b1ApprovedUserCode = userCode;
