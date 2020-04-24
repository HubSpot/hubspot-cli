const fileMapper = jest.genMockFromModule('../fileMapper');

/**
 * GET /content/filemapper/v1/download/cms-theme-boilerplate/modules/Card section.module
 * `hscms fetch cms-theme-boilerplate/modules/Card section.module`
 */
const moduleFileRequestData = {
  path: '/cms-theme-boilerplate/modules/Card section.module',
  source: null,
  id: 3388631096,
  createdAt: 1553704188417,
  updatedAt: 1563811645168,
  folder: true,
  children: [
    {
      path: '/cms-theme-boilerplate/modules/Card section.module/module.css',
      source:
        ".cards {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: space-between;\n}\n.card {\n  flex: 0 1 320px;\n  display: flex;\n  margin: 1rem 0;\n}\n.card__image {\n  flex: 0 0 30px;\n}\n.card__text {\n  flex: 1 1 100%;\n  padding: 0 1rem;\n}\n.card:after {\n  content: '';\n  flex: auto;\n}\n",
      id: 0,
      createdAt: 0,
      updatedAt: 0,
      folder: false,
      children: [],
      buffer: false,
      parentPath: '/cms-theme-boilerplate/modules/Card section.module',
      name: 'module.css',
    },
    {
      path: '/cms-theme-boilerplate/modules/Card section.module/fields.json',
      source:
        '[ {\n  "id" : "2b5f72ac-f597-4e6c-3088-8ec5d34d42a2",\n  "name" : "card",\n  "label" : "Card",\n  "sortable" : false,\n  "required" : false,\n  "locked" : false,\n  "occurrence" : {\n    "min" : 1,\n    "max" : null,\n    "sorting_label_field" : "f9736637-449e-fb28-92e3-db33615c7a9a",\n    "default" : 3\n  },\n  "children" : [ {\n    "id" : "854158f8-6ef2-6545-6bac-437c2acddbb1",\n    "name" : "image",\n    "label" : "Image",\n    "sortable" : false,\n    "required" : false,\n    "locked" : false,\n    "responsive" : false,\n    "resizable" : false,\n    "type" : "image",\n    "default" : {\n      "src" : "https://cdn2.hubspot.net/hubfs/1932631/Email_Templates/Prototype/services_7.png",\n      "alt" : "services_7",\n      "width" : 35,\n      "height" : 32\n    }\n  }, {\n    "id" : "f9736637-449e-fb28-92e3-db33615c7a9a",\n    "name" : "title",\n    "label" : "Title",\n    "sortable" : false,\n    "required" : true,\n    "locked" : false,\n    "validation_regex" : "",\n    "allow_new_line" : false,\n    "show_emoji_picker" : false,\n    "type" : "text",\n    "default" : "This is a title"\n  }, {\n    "id" : "48792a2c-3377-4a0a-0070-e1a893ae82b3",\n    "name" : "text",\n    "label" : "Text",\n    "sortable" : false,\n    "required" : false,\n    "locked" : false,\n    "validation_regex" : "",\n    "allow_new_line" : false,\n    "show_emoji_picker" : false,\n    "type" : "text",\n    "default" : "Contextual advertising can be profitable. It can either pay for your hosting and maintenance costs for you website or it can pay for a lot more."\n  } ],\n  "type" : "group",\n  "default" : [ {\n    "image" : {\n      "src" : "https://cdn2.hubspot.net/hubfs/1932631/Email_Templates/Prototype/services_7.png",\n      "alt" : "services_7",\n      "width" : 35,\n      "height" : 32\n    },\n    "title" : "This is a title",\n    "text" : "Contextual advertising can be profitable. It can either pay for your hosting and maintenance costs for you website or it can pay for a lot more."\n  }, {\n    "image" : {\n      "src" : "https://cdn2.hubspot.net/hubfs/1932631/Email_Templates/Prototype/services_7.png",\n      "alt" : "services_7",\n      "width" : 35,\n      "height" : 32\n    },\n    "title" : "This is a title",\n    "text" : "Contextual advertising can be profitable. It can either pay for your hosting and maintenance costs for you website or it can pay for a lot more."\n  }, {\n    "image" : {\n      "src" : "https://cdn2.hubspot.net/hubfs/1932631/Email_Templates/Prototype/services_7.png",\n      "alt" : "services_7",\n      "width" : 35,\n      "height" : 32\n    },\n    "title" : "This is a title",\n    "text" : "Contextual advertising can be profitable. It can either pay for your hosting and maintenance costs for you website or it can pay for a lot more."\n  } ]\n} ]',
      id: 0,
      createdAt: 0,
      updatedAt: 0,
      folder: false,
      children: [],
      buffer: false,
      parentPath: '/cms-theme-boilerplate/modules/Card section.module',
      name: 'fields.json',
    },
    {
      path: '/cms-theme-boilerplate/modules/Card section.module/module.js',
      source: '',
      id: 0,
      createdAt: 0,
      updatedAt: 0,
      folder: false,
      children: [],
      buffer: false,
      parentPath: '/cms-theme-boilerplate/modules/Card section.module',
      name: 'module.js',
    },
    {
      path: '/cms-theme-boilerplate/modules/Card section.module/_locales',
      source: null,
      id: 0,
      createdAt: 0,
      updatedAt: 0,
      folder: true,
      children: [],
      buffer: false,
      parentPath: '/cms-theme-boilerplate/modules/Card section.module',
      name: '_locales',
    },
    {
      path: '/cms-theme-boilerplate/modules/Card section.module/meta.json',
      source:
        '{\n  "content_tags" : [ ],\n  "css_assets" : [ ],\n  "editable_contexts" : [ ],\n  "external_js" : [ ],\n  "extra_classes" : "",\n  "global" : false,\n  "host_template_types" : [ "PAGE" ],\n  "js_assets" : [ ],\n  "other_assets" : [ ],\n  "placement_rules" : [ ],\n  "purchased" : false,\n  "smart_type" : "NOT_SMART",\n  "tags" : [ ],\n  "module_id" : 3850729,\n  "is_available_for_new_content" : true\n}',
      id: 0,
      createdAt: 0,
      updatedAt: 0,
      folder: false,
      children: [],
      buffer: false,
      parentPath: '/cms-theme-boilerplate/modules/Card section.module',
      name: 'meta.json',
    },
    {
      path: '/cms-theme-boilerplate/modules/Card section.module/module.html',
      source:
        '<div class="cards">\n  {% for card in module.card %}\n  <div class="cards__card card">\n    {% if card.image.src %}\n    <div class="card__image">\n      <img src="{{ card.image.src }}" alt="{{ card.image.alt }}" width="{{ card.image.width }}" height="{{ card.image.height }}">\n    </div>\n    {% endif %}\n    <div class="card__text">\n      {% inline_text field="title" value="{{ card.title }}" %}\n      {% inline_text field="text" value="{{ card.text }}" %}\n    </div>\n  </div>\n  {% endfor %}\n</div>',
      id: 0,
      createdAt: 0,
      updatedAt: 0,
      folder: false,
      children: [],
      buffer: false,
      parentPath: '/cms-theme-boilerplate/modules/Card section.module',
      name: 'module.html',
    },
  ],
  buffer: false,
  parentPath: '/cms-theme-boilerplate/modules',
  name: 'Card section.module',
};

/**
 * GET /content/filemapper/v1/download/folder/1234
 * `hscms fetch 1234`
 */
const folderRequestData = {
  path: '/1234',
  source: null,
  id: 0,
  createdAt: 1562101216967,
  updatedAt: 1562101216967,
  folder: true,
  children: [
    {
      path: '/1234/test.html',
      source:
        '<!--\n    templateType: page\n    isAvailableForNewContent: false\n-->\n<div>\n\thello new stuff\n\thello new stuff\n\thello new stuff\n</div>\n',
      id: 0,
      createdAt: 0,
      updatedAt: 1565214001268,
      folder: false,
      children: [],
      buffer: false,
      parentPath: '/1234',
      name: 'test.html',
    },
  ],
  buffer: false,
  parentPath: '/',
  name: '1234',
};

/**
 * GET /content/filemapper/v1/download/all
 * `hscms fetch /`
 */
const allRequestData = {
  path: '/',
  source: null,
  id: 0,
  createdAt: 1485979132051,
  updatedAt: 1485979132051,
  folder: true,
  parentPath: '',
  name: '',
  children: [folderRequestData],
};

/*
 * These must be wrapped with `jest.fn()` otherwise `jest.spyOn()` will not work.
 */

fileMapper.download = jest.fn(async (portalId, filepath) => {
  if (filepath === '@root') {
    return allRequestData;
  }
  if (moduleFileRequestData.path.includes(filepath)) {
    return moduleFileRequestData;
  }
  if (folderRequestData.path.includes(filepath)) {
    return folderRequestData;
  }
  throw new Error({ statusCode: 404 });
});

module.exports = fileMapper;
