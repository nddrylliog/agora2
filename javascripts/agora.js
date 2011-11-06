(function() {
  var HOST, app, showdown;
  HOST = 'http://192.168.1.64:3000/';
  showdown = new Showdown.converter();
  app = $.sammy('#main', function() {
    this.use('Template');
    this.bind('render-all', function(event, args) {
      return this.load(HOST + args.path, {
        json: true
      }).then(function(content) {
        return this.renderEach(args.template, args.name, content).appendTo(args.target);
      });
    });
    this.get('#/', function(context) {
      context.app.swap('');
      this.partial('templates/home.template');
      return this.trigger('render-all', {
        path: 'categories',
        template: 'templates/category-summary.template',
        name: 'category',
        target: '.categories'
      });
    });
    this.get('#/:slug', function(context) {
      var him, me, slug;
      me = {
        nickname: "BlueSky",
        slogan: "Win j'en ai eu ma dows, COMME MA BITE",
        avatar: "/stylesheets/avatar2.png"
      };
      him = {
        nickname: "Sylvain",
        slogan: "Mousse de canard",
        avatar: "/stylesheets/avatar1.png"
      };
      slug = this.params['slug'];
      return this.load(HOST + 'category/' + slug, {
        json: true
      }).then(function(category) {
        context.partial('templates/category.template', {
          category: category
        });
        return context.render('templates/new-thread.template', {
          post: {
            user: me,
            category: category._id
          }
        }).appendTo('.threads').then(function() {
          this.trigger('setup-thread-opener');
          this.trigger('setup-post-editor');
          category.threads.forEach(function(thread) {
            return thread.category = category;
          });
          return this.renderEach('templates/thread-summary.template', 'thread', category.threads).appendTo('.threads');
        });
      });
    });
    this.get('#/:slug/:tid', function(context) {
      var tid;
      tid = this.params['tid'];
      return $.ajax({
        url: HOST + 'thread/' + tid,
        dataType: 'json',
        success: function(thread) {
          var user;
          user = {
            nickname: thread.nickname,
            slogan: "Un pour tous, tous pour un",
            avatar: ""
          };
          return context.partial('templates/thread.template', {
            thread: thread
          }).then(function() {
            thread.posts.forEach(function(post) {
              var content;
              content = showdown.makeHtml(post.source);
              return context.render('templates/post.template', {
                post: {
                  content: content,
                  user: user
                }
              }).appendTo('.thread');
            });
            return context.render('templates/post-reply.template', {
              post: {
                user: user,
                tid: tid
              }
            }).appendTo('.thread').then(function() {
              this.trigger('setup-post-editor');
              return $('.submit-post').click(function() {
                return context.trigger('post-reply');
              });
            });
          });
        }
      });
    });
    this.bind('setup-thread-opener', function() {
      var context;
      context = this;
      $('.post-title').blur(function() {
        if ($(this).val() === "") {
          return $('.new-post').slideUp();
        }
      });
      $('.post-title').focus(function() {
        return $('.new-post').slideDown();
      });
      return $('.submit-post').click(function() {
        return context.trigger('new-thread');
      });
    });
    this.bind('setup-post-editor', function() {
      var context;
      context = this;
      $('.post-source').blur(function() {
        var preview, source;
        source = $(this);
        source.hide();
        preview = source.parent().children('.post-preview');
        return preview.html(showdown.makeHtml(source.val())).show();
      });
      return $('.post-preview').click(function() {
        var preview, source;
        preview = $(this);
        preview.hide();
        source = preview.parent().children('.post-source');
        return source.show().focus();
      });
    });
    this.bind('post-reply', function(context) {
      return $.post(HOST + 'post-reply', {
        username: "bluesky",
        tid: $('.reply-thread').val(),
        source: $('.post-source').val()
      }, function(data) {
        return alert("post reply successful");
      });
    });
    return this.bind('new-thread', function(context) {
      return $.post(HOST + 'new-thread', {
        username: "bluesky",
        category: $('.post-category').val(),
        title: $('.post-title').val(),
        source: $('.post-source').val()
      }, function(data) {
        return alert("new thread successful");
      });
    });
  });
  $(function() {
    return app.run('#/');
  });
}).call(this);
