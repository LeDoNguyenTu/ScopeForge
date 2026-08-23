# Release Checklist

Before a production release:

- CI is green on the release commit.
- Supabase security advisor is reviewed.
- Required environment variables are configured only in the deployment platform.
- Custom domain DNS is verified before traffic is switched.
- TLS is active before public `.dev` traffic is enabled.
- Authentication abuse controls are enabled.
- Active scanner changes include authorization and scope tests.
- Documentation matches the capability actually shipped.
