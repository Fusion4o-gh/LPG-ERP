import { ok, serviceError } from "../../../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { readJson } from "../../../../../../server/api/validation.ts";
import { getUserAreaAssignments, listAreasForMapping, setUserAreas } from "../../../../../../server/services/user-management/user-management.ts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const [areas, assignment] = await Promise.all([listAreasForMapping(context), getUserAreaAssignments(context, id)]);
    return ok({ areas, user: assignment.user, assignedAreaIds: assignment.assignedAreaIds });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const areaIds = Array.isArray(body.areaIds) ? (body.areaIds as string[]) : [];
    const result = await setUserAreas(context, id, areaIds);
    return ok(result);
  } catch (error) {
    return serviceError(error);
  }
}
