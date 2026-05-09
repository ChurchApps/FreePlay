import { API_BASE } from "@env";
import { ApiHelper } from "./ApiHelper";

export class EnvironmentHelper {
  public static MembershipApi = "";
  public static MessagingApi = "";
  public static DoingApi = "";

  static init = () => {
    //EnvironmentHelper.initDev();
    //EnvironmentHelper.initStaging();
    EnvironmentHelper.initProd();

    ApiHelper.apiConfigs = [
      { keyName: "MembershipApi", url: EnvironmentHelper.MembershipApi, jwt: "", permisssions: [] },
      { keyName: "MessagingApi", url: EnvironmentHelper.MessagingApi, jwt: "", permisssions: [] },
      { keyName: "DoingApi", url: EnvironmentHelper.DoingApi, jwt: "", permisssions: [] }
    ];
  };

  private static applyApiBase = (base: string) => {
    const trimmed = base.replace(/\/$/, "");
    EnvironmentHelper.MembershipApi = trimmed + "/membership";
    EnvironmentHelper.MessagingApi = trimmed + "/messaging";
    EnvironmentHelper.DoingApi = trimmed + "/doing";
  };

  static initDev = () => {
    EnvironmentHelper.applyApiBase(API_BASE || "");
  };

  static initStaging = () => {
    EnvironmentHelper.applyApiBase("https://api.staging.churchapps.org");
  };

  static initProd = () => {
    EnvironmentHelper.applyApiBase("https://api.churchapps.org");
  };

}
