# Federated Wiki - Method Plugin

The Method plugin keeps a running tally of calculations expressed as a series of lines.

See [About Method Plugin](http://fed.wiki.org/about-method-plugin.html) for how-to documentation about this plugin.

See [About Plugins](http://plugins.fed.wiki.org/about-plugins.html) for general information about plugins.

### Development

Most of the calculation machinery can be tested in node.js at build time.

```
grunt build
```
to compile coffeescript and run non-ui tests.
```
grunt watch
````
to build on updates to plugin or tests.
