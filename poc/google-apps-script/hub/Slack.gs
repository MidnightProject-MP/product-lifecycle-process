function postSlackMessage_(channel, text, threadTs) {
  const token = getScriptProperty_('SLACK_BOT_TOKEN');
  if (!token) throw new Error('Missing SLACK_BOT_TOKEN script property.');
  if (!channel) throw new Error('Missing Slack channel.');

  const payload = {
    channel: channel,
    text: text
  };
  if (threadTs) payload.thread_ts = threadTs;

  const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  if (!body.ok) {
    throw new Error('Slack post failed: ' + (body.error || response.getContentText()));
  }

  return {
    ts: body.ts,
    channel: body.channel,
    permalink: getSlackPermalink_(body.channel, body.ts)
  };
}

function getSlackPermalink_(channel, ts) {
  const token = getScriptProperty_('SLACK_BOT_TOKEN');
  const url = 'https://slack.com/api/chat.getPermalink?channel=' +
    encodeURIComponent(channel) +
    '&message_ts=' +
    encodeURIComponent(ts);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  return body.ok ? body.permalink : '';
}

