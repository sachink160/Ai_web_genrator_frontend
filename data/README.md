# Data Files Directory

This directory contains JSON data files that can be used to populate Jinja templates in the frontend.

## File Structure

Each JSON file should follow this schema:

```json
{
  "name": "Person/Company Name",
  "email": "contact@example.com",
  "phone": "+1-555-0000",
  "company": "Company Name",
  "position": "Job Title",
  "profile_photo": "https://example.com/photo.jpg",
  "address": {
    "street": "Street Address",
    "city": "City",
    "state": "State/Province",
    "country": "Country",
    "zipcode": "Postal Code"
  },
  "bio": "Brief biography or description",
  "website": "https://example.com",
  "social": {
    "linkedin": "https://linkedin.com/in/username",
    "github": "https://github.com/username",
    "twitter": "https://twitter.com/username"
  }
}
```

## Variable Usage in Templates

In your Jinja templates, you can use these variables like:

```html
<h1>{{ name }}</h1>
<p>{{ email }}</p>
<p>{{ phone }}</p>
<p>{{ address.city }}, {{ address.country }}</p>
<p>{{ bio }}</p>
```

## Available Data Files

1. **customer1.json** - Tech Professional (Sarah Johnson)
2. **customer2.json** - Cloud Kitchen Owner (Raj Patel)
3. **customer3.json** - Creative Designer (Maria Garcia)

## Adding New Data Files

1. Create a new JSON file in this directory
2. Follow the schema above
3. The file will automatically appear in the data selector dropdown
4. All fields are optional, but `name` is recommended

## Phase 1 (Current)

- Simple variable replacement: `{{ variable }}`
- Nested object access: `{{ address.city }}`

## Future Phases

Will support:
- Loops: `{% for item in items %}`
- Filters: `{{ name|upper }}`
- Conditionals: `{% if premium %}`
