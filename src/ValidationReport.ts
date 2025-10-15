import * as OBC from "@thatopen/components";
import { makeBIMPortalRequest } from "./BIMPortal/api";
import { paths } from "./BIMPortal/types";

interface IDSResult {
  pass: string[];
  fail: string[];
  warn?: string[];
  results: any;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function runIDSCheck(components: OBC.Components, idsXML: any): Promise<IDSResult> {
  const ids = components.get(OBC.IDSSpecifications);
  const fragments = components.get(OBC.FragmentsManager);

  // fragment ids in regex
  const fragmentIds = Array.from(fragments.list.keys()).map(id => new RegExp(escapeRegExp(id)));

  // Ids Spezifikation
  const specs = ids.load(idsXML);
  console.log("Loaded IDS Specs:", specs);
  //const spec = ids.create("DoorFireRating", ["IFC4"]);
  //spec.description = "Alle Türen müssen FireRating in Pset_DoorCommon definiert haben";

  const allPass: string[] = [];
  const allFail: string[] = [];
  const allWarnings: string[] = [];

  const specResults = {
    passed: [] as Array<{name: string, description?: string, guids: string[]}>,
    failed: [] as Array<{name: string, description?: string, guids: string[]}>,
    summary: {
      totalSpecs: specs.length,
      passedSpecs: 0,
      failedSpecs: 0,
      totalPassedElements: 0,
      totalFailedElements: 0
    }
  };

  for (const spec of specs) {
    try {
        const result = await spec.test(fragmentIds);
        const { pass, fail } = ids.getModelIdMap(result);
        console.log("IDS Check Result for spec", spec.name, { pass, fail });
        const passGuids = (await fragments.modelIdMapToGuids(pass));
        const failGuids =(await fragments.modelIdMapToGuids(fail));

        allPass.push(...passGuids);
        allFail.push(...failGuids);

        if (failGuids.length > 0) {
          specResults.failed.push({
            name: spec.name,
            description: spec.description,
            guids: failGuids
          });
          specResults.summary.failedSpecs++;
          specResults.summary.totalFailedElements += failGuids.length;
        }

        if (passGuids.length > 0) {
          specResults.passed.push({
            name: spec.name,
            description: spec.description,
            guids: passGuids
          });
          specResults.summary.passedSpecs++;
          specResults.summary.totalPassedElements += passGuids.length;
        }
    } catch (error) {
        console.error("Error testing spec", spec.name);
    }
  }

  /* const entity = new OBC.IDSEntity(components, { type: "simple", parameter: "IFCDOOR" });
  const property = new OBC.IDSProperty(
    components,
    { type: "simple", parameter: "Pset_DoorCommon" },
    { type: "simple", parameter: "FireRating" }
  ); */
  //spec.applicability.add(entity);
  //spec.requirements.add(property);

  //const result = await spec.test(fragmentIds);
  //const { pass, fail } = ids.getModelIdMap(result);

  //const passIds = Object.values(pass).flatMap((s: Set<number>) => Array.from(s).map(String));
  //const failIds = Object.values(fail).flatMap((s: Set<number>) => Array.from(s).map(String));

  console.log("IDS Checks Report");
  console.log("Passed IDs:", allPass);
  console.log("Failed IDs:", allFail);

  return { pass: allPass, fail: allFail, results: specResults };
}

export async function logTest(components: OBC.Components, idsXML: string) {
    console.log(idsXML)
    const report = await runIDSCheck(components, idsXML);
    console.log(components);
    console.log("report: " + JSON.stringify(report));
}

export async function IdsRequest(url: keyof paths, guid: string): Promise<string | null> {
    try {
        const response = await makeBIMPortalRequest(url, "get", guid);
        return response as unknown as string;
    } catch (error) {
        console.error("IDS Request failed:", error);
        return null;
    }
}
