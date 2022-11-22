import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';

import fetch from 'node-fetch';
import { gzip } from 'node-gzip';

async function run(): Promise<void> {
  const [url, token] = getIssuesAPIConfig();

  info('Fetching SARIF from Issues API…');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/sarif+json;consumer=github',
      authorization: `Bearer ${token}`
    }
  });

  if (response.ok) {
    const sarif = await response.text();
    const compressedSarif = await gzip(sarif);

    {
      info('Uploading SARIF to GitHub Repository…');

      const octokit = getOctokit(getInput('token'));
      const response = await octokit.request(
        'POST /repos/{owner}/{repo}/code-scanning/sarifs',
        {
          owner: context.repo.owner,
          repo: context.repo.repo,
          commit_sha: context.sha,
          ref: context.ref,
          sarif: compressedSarif.toString('base64')
        }
      );

      if (response.status < 400) {
        setOutput('url', response.data.url);
      } else {
        setFailed(response.status.toString());
      }
    }
  } else {
    setFailed(response.statusText);
  }
}

function getIssuesAPIConfig(): [string, string] {
  const url = new URL(getInput('issues-api-url'));
  const token = url.username;
  url.username = '';

  return [url.toString(), token];
}

run();
