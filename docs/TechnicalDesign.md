# Technical Design

To provide CMS developers with a flexible and powerful set of tools, the technical design is as follows:

1. The commands should follow Unix best practices in terms of composibility. See [Unix Philosophy](https://en.wikipedia.org/wiki/Unix_philosophy)

```
Write programs that do one thing and do it well.
Write programs to work together.
Write programs to handle text streams, because that is a universal interface.
```

2. Don't prescribe a particular node task runner (Gulp, Grunt, etc...). Instead work to separate the cli from the underlying functionality so that we can easily create a library separate from the CLI for use in the creation of tasks.

3. Support multiple portals. It should be easy to run the commands against multiple portals.

4. Minimize dependencies.

5. Plan for the code to be open source.
