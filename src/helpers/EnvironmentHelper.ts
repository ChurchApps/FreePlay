import { API_BASE } from "@env";
import { ApiHelper } from "./ApiHelper";

export class EnvironmentHelper {
  public static MembershipApi = "";
  public static MessagingApi = "";
  public static DoingApi = "";
  public static RelayApi = "";

  static init = () => {
    const env = (process.env.EXPO_PUBLIC_FREEPLAY_ENV || "prod").toLowerCase();
    if (env === "dev") EnvironmentHelper.initDev();
    else if (env === "staging") EnvironmentHelper.initStaging();
    else EnvironmentHelper.initProd();

    ApiHelper.apiConfigs = [
      { keyName: "MembershipApi", url: EnvironmentHelper.MembershipApi, jwt: "", permisssions: [] },
      { keyName: "MessagingApi", url: EnvironmentHelper.MessagingApi, jwt: "", permisssions: [] },
      { keyName: "DoingApi", url: EnvironmentHelper.DoingApi, jwt: "", permisssions: [] },
      { keyName: "RelayApi", url: EnvironmentHelper.RelayApi, jwt: "", permisssions: [] }
    ];
  };

  private static applyApiBase = (base: string) => {
    const trimmed = base.replace(/\/$/, "");
    EnvironmentHelper.MembershipApi = trimmed + "/membership";
    EnvironmentHelper.MessagingApi = trimmed + "/messaging";
    EnvironmentHelper.DoingApi = trimmed + "/doing";
    EnvironmentHelper.RelayApi = EnvironmentHelper.MembershipApi;
  };

  static initDev = () => {
    EnvironmentHelper.applyApiBase(API_BASE || "");
    // The OAuth relay callback must be reachable from the phone that scans the QR, which localhost isn't.
    EnvironmentHelper.RelayApi = "https://api.churchapps.org/membership";
  };

  static initStaging = () => {
    EnvironmentHelper.applyApiBase("https://api.staging.churchapps.org");
  };

  static initProd = () => {
    EnvironmentHelper.applyApiBase("https://api.churchapps.org");
  };

}
