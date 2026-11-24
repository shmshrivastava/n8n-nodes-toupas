# n8n-nodes-toupas

Put websites and apps with saved data live at a link anyone can open, from your n8n workflows.

[Toupas](https://toupas.com) makes a page live as soon as it's sent: a weekly report written by an AI model, a landing page for each new lead, or a form that saves what people send, with sign-in and access rules. No servers to set up.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Usage](#usage) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-toupas`.

## Credentials

1. Sign in to the Toupas panel at [app.toupas.com](https://app.toupas.com) (a new account starts with a free trial).
2. Open **Keys**, choose **Make key**, and copy the key. It's shown once and starts with `tps_`.
3. In n8n, create a **Toupas API** credential and paste the key. Leave **Toupas Address** as it is.

A key can make websites and apps live in that one Toupas account, and nothing else: it can't change settings, members or payments. It stops working when it ends (after 90 days or a year, as you chose), when it's removed in the panel, or after 90 days without use. Toupas emails you whenever a key is made.

## Operations

**Website**

- **Publish**: put a website live, or update the one with the same name (it keeps its link). Send one page from the **Page HTML** field, or several files (pages, styles, scripts, images) from earlier steps.
- **Get**: a website's link and whether it's live.
- **Get Many**: the websites and apps in the account.

**App** (pages that save data)

- **Publish**: put an app live with its **Data Description**, or update it. Leave the description empty to change only the pages.
- **Get**: an app's link and whether it's live.

Every answer includes `message`, a sentence saying what happened, and the link under `website.link`.

## Usage

### One page from an AI model

Connect an AI step that writes a whole HTML page to **Toupas → Website → Publish**, with **Files From** set to *HTML Field* and **Page HTML** set to the AI's output. Give it a fixed name, such as `Weekly report`: each run updates the same page at the same link.

### Several files

Set **Files From** to *Input Files* and list the binary fields that hold them (for example `data, style`). Each file keeps its name, so one must be `index.html`. Turn on **Remove Files Not Sent** to make the files sent the whole site.

### Apps with saved data

The data description says what the app saves and who can do what. A sign-up list anyone can add to, which only the app's admins can read:

```json
{
  "signup": "open",
  "models": {
    "signup": {
      "fields": {
        "name": { "type": "text", "required": true, "maxLength": 100 },
        "email": { "type": "email", "required": true }
      },
      "access": { "create": "public", "read": ["admin"] }
    }
  }
}
```

The pages load `<script src="/_toupas/client.js"></script>` and save with `toupas.create('signup', { name, email })`. Field types: text, number, boolean, date, datetime, choice, email, url, json, relation. Who can do what: `public`, `signedIn`, `owner` (who added the row), `admin`, or your own roles.

The field is plain JSON because a description can hold any number of models and fields.

### Use it from an AI Agent

The node can be used as a tool by n8n's AI Agent, for example to let the agent publish the page it has just written.

## Compatibility

Built with `@n8n/node-cli` 0.58 against `n8n-workflow` 2.49.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Toupas](https://toupas.com)

## Version history

- **0.1.0**: Website Publish, Get and Get Many; App Publish and Get.
