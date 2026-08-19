import { badRequest, json, methodNotAllowed, serverError } from "../lib/http.js";
import {
  clearJobAccessCookie,
  deleteJobData,
  getAuthorizedJob,
  hasRequiredBindings,
  retentionFields,
  tokenFromBodyOrCookie,
  tokenFromJobCookie
} from "../lib/jobs.js";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  if (!hasRequiredBindings(env)) {
    return serverError("Secure conversion storage is not configured yet.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid delete request.");
  }

  const jobId = String(body.jobId || "");
  const bodyToken = String(body.token || "");
  const token = tokenFromBodyOrCookie(request, jobId, bodyToken);
  const job = await getAuthorizedJob(env, jobId, token);
  if (!job) return badRequest("Unknown or expired conversion.");

  const deletedJob = await deleteJobData(env, job);
  if (!deletedJob || deletedJob.deletionCompleted === false) {
    // Honest receipt: the files still exist, nothing was marked deleted, and no
    // pointers were cleared, so the user (or the expiry sweeper via
    // enforceJobExpiry / sourceExpired, which still has the pointers it needs)
    // can retry the cleanup later. Keep the access cookie so the user can retry.
    return serverError(
      "Deletion did not complete: the file storage service is temporarily unavailable and not all files could be removed. " +
        "Nothing was marked as deleted and the stored file records were kept intact, so this conversion can be deleted again later; " +
        "the automatic expiry cleanup will also re-attempt removal of retained files when they expire."
    );
  }

  const headers = tokenFromJobCookie(request, jobId) ? { "Set-Cookie": clearJobAccessCookie() } : {};

  return json(
    {
      status: "deleted",
      jobId: deletedJob.id,
      ...retentionFields(deletedJob),
      message: "This conversion and its stored files were deleted."
    },
    { headers }
  );
}
