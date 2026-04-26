// Uncomment to use environment variables from .env file
import { API_BASE, LESSONS_API } from "@env";
import { ApiHelper } from "./ApiHelper";

export class EnvironmentHelper {
  public static MembershipApi = "";
  public static LessonsApi = "";
  public static MessagingApi = "";
  public static DoingApi = "";

  static init = () => {
    //EnvironmentHelper.initDev();
    //EnvironmentHelper.initStaging();
    EnvironmentHelper.initProd();

    ApiHelper.apiConfigs = [
      { keyName: "MembershipApi", url: EnvironmentHelper.MembershipApi, jwt: "", permisssions: [] },
      { keyName: "LessonsApi", url: EnvironmentHelper.LessonsApi, jwt: "", permisssions: [] },
      { keyName: "MessagingApi", url: EnvironmentHelper.MessagingApi, jwt: "", permisssions: [] },
      { keyName: "DoingApi", url: EnvironmentHelper.DoingApi, jwt: "", permisssions: [] }
    ];

    //leaving for now as a hack.  For some reason outputting the value makes the difference of whether it's actually populated or not.
    console.log(JSON.stringify(ApiHelper.apiConfigs[1].url));
  };

  private static applyApiBase = (base: string) => {
    const trimmed = base.replace(/\/$/, "");
    EnvironmentHelper.MembershipApi = trimmed + "/membership";
    EnvironmentHelper.MessagingApi  = trimmed + "/messaging";
    EnvironmentHelper.DoingApi      = trimmed + "/doing";
  };

  static initDev = () => {
    console.log("ENV values:", { API_BASE, LESSONS_API });
    EnvironmentHelper.applyApiBase(API_BASE || "");
    EnvironmentHelper.LessonsApi = LESSONS_API || "";
  };

  static initStaging = () => {
    EnvironmentHelper.applyApiBase("https://api.staging.churchapps.org");
    EnvironmentHelper.LessonsApi = "https://api.staging.lessons.church";
  };

  // NOTE - None of these values are secret
  static initProd = () => {
    EnvironmentHelper.applyApiBase("https://api.churchapps.org");
    EnvironmentHelper.LessonsApi = "https://api.lessons.church";
  };

}
