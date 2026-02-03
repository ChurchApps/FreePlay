// Uncomment to use environment variables from .env file
import { MEMBERSHIP_API, LESSONS_API, MESSAGING_API, DOING_API } from "@env"
import { ApiHelper } from "./ApiHelper";

// Declare these as fallbacks when not using @env imports
//declare const MEMBERSHIP_API: string | undefined;
//declare const LESSONS_API: string | undefined;





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
    ]

    //leaving for now as a hack.  For some reason outputting the value makes the difference of whether it's actually populated or not.
    console.log(JSON.stringify(ApiHelper.apiConfigs[1].url));
  }

  static initDev = () => {
    console.log("ENV values:", { MEMBERSHIP_API, LESSONS_API, MESSAGING_API, DOING_API });
    EnvironmentHelper.MembershipApi = MEMBERSHIP_API || "";
    EnvironmentHelper.LessonsApi = LESSONS_API || "";
    EnvironmentHelper.MessagingApi = MESSAGING_API || "";
    EnvironmentHelper.DoingApi = DOING_API || "";
  }

  static initStaging = () => {
    EnvironmentHelper.MembershipApi = "https://api.staging.churchapps.org/membership";
    EnvironmentHelper.LessonsApi = "https://api.staging.lessons.church";
    EnvironmentHelper.MessagingApi = "https://api.staging.churchapps.org/messaging";
    EnvironmentHelper.DoingApi = "https://api.staging.churchapps.org/doing";
  }

  // NOTE - None of these values are secret
  static initProd = () => {
    EnvironmentHelper.MembershipApi = "https://api.churchapps.org/membership";
    EnvironmentHelper.LessonsApi = "https://api.lessons.church";
    EnvironmentHelper.MessagingApi = "https://api.churchapps.org/messaging";
    EnvironmentHelper.DoingApi = "https://api.churchapps.org/doing";
  }

}
