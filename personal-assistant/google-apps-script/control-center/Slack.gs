function postSlackMessage_(channel, text, threadTs, replyBroadcast) {
  const token = getScriptProperty_('SLACK_BOT_TOKEN');
  if (!token) throw new Error('Missing SLACK_BOT_TOKEN script property.');
  if (!channel) throw new Error('Missing Slack channel.');

  const payload = {
    channel: channel,
    text: text
  };
  if (threadTs) payload.thread_ts = String(threadTs);
  if (threadTs && replyBroadcast) payload.reply_broadcast = true;

  const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  if (!body.ok) {
    logHub_('ERROR', 'postSlackMessage_', '', 'Slack API returned error.', {
      error: body.error,
      channel: channel,
      threadTs: threadTs,
      replyBroadcast: Boolean(replyBroadcast),
      response: body
    });
    throw new Error('Slack post failed: ' + (body.error || response.getContentText()));
  }

  return {
    ts: body.ts,
    channel: body.channel,
    permalink: getSlackPermalink_(body.channel, body.ts)
  };
}

function updateSlackMessage_(channel, ts, text) {
  const token = getScriptProperty_('SLACK_BOT_TOKEN');
  if (!token) throw new Error('Missing SLACK_BOT_TOKEN script property.');
  if (!channel) throw new Error('Missing Slack channel for update.');
  if (!ts) throw new Error('Missing Slack message timestamp for update.');

  const response = UrlFetchApp.fetch('https://slack.com/api/chat.update', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify({
      channel: channel,
      ts: String(ts),
      text: text
    }),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  if (!body.ok) {
    logHub_('ERROR', 'updateSlackMessage_', '', 'Slack API returned error.', {
      error: body.error,
      channel: channel,
      ts: ts,
      response: body
    });
    throw new Error('Slack update failed: ' + (body.error || response.getContentText()));
  }

  return {
    ts: body.ts || ts,
    channel: body.channel || channel,
    permalink: getSlackPermalink_(body.channel || channel, body.ts || ts)
  };
}

function getSlackPermalink_(channel, ts) {
  const token = getScriptProperty_('SLACK_BOT_TOKEN');
  const url = 'https://slack.com/api/chat.getPermalink?channel=' +
    encodeURIComponent(channel) +
    '&message_ts=' +
    encodeURIComponent(String(ts));

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
