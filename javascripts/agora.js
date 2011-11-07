(function() {
  var HOST, app, showdown;
  HOST = 'http://ldmf.ch/';
  showdown = new Showdown.converter();
  app = $.sammy('#main', function() {
    var format_date, get_user;
    this.use('Template');
    this.use('Storage');
    this.use('Session');
    get_user = function(username, cb) {
      var user;
      user = this.session('user/' + username);
      if (user) {
        return cb(user);
      } else {
        return $.get(HOST + 'user/' + username, {}, function(data) {
          return cb(data);
        });
      }
    };
    format_date = function(timestamp) {
      var date, pad;
      pad = function(number) {
        if (number < 10) {
          return '0' + number;
        } else {
          return '' + number;
        }
      };
      date = new Date(timestamp);
      return pad(date.getDate()) + " " + ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][date.getMonth()] + " " + date.getFullYear() + " à " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    };
    this.before(function(context) {
      this.user = this.session('user');
      this.get_user = function(username, data) {
        return get_user.apply(this, [username, data]);
      };
      if (context.path !== '#/login') {
        if (!this.user) {
          $('.user-info').fadeOut();
          this.redirect('#/login');
          return false;
        }
        $('.nickname').text(this.user.nickname);
        $('.avatar').attr('src', this.user.avatar);
        return $('.user-info').fadeIn();
      }
    });
    this.bind('render-all', function(event, args) {
      return this.load(HOST + args.path, {
        json: true
      }).then(function(content) {
        return this.renderEach(args.template, args.name, content).appendTo(args.target);
      });
    });
    this.get('#/login', function(context) {
      return this.partial('templates/login.template').then(function() {
        return $('#password').keypress(function(event) {
          if (event.which !== 13) {
            return;
          }
          event.preventDefault();
          return $.post(HOST + 'login', {
            login: $('#login').val(),
            password: $('#password').val()
          }, function(data) {
            context.log(data);
            switch (data.result) {
              case "failure":
                return context.log("Log-in failed!");
              case "success":
                context.log("Log-in succeeded!");
                context.session('user', data.user);
                context.session('token', data.session_token);
                return context.redirect('#/');
            }
          });
        });
      });
    });
    this.get('#/logout', function(context) {
      $('.user-info').fadeOut();
      $.post(HOST + 'logout', {
        token: this.session('token')
      }, function(data) {
        return context.log('Logged out gracefully!');
      });
      this.session('user', null);
      this.session('token', null);
      return this.redirect('#/login');
    });
    this.get('#/', function(context) {
      this.partial('templates/home.template');
      return this.trigger('render-all', {
        path: 'categories',
        template: 'templates/category-summary.template',
        name: 'category',
        target: '.categories'
      });
    });
    this.get('#/r/:slug', function(context) {
      var slug;
      slug = this.params['slug'];
      return this.load(HOST + 'category/' + slug, {
        json: true
      }).then(function(category) {
        context.partial('templates/category.template', {
          category: category
        });
        return context.render('templates/new-thread.template', {
          post: {
            user: context.user,
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
    this.get('#/r/:slug/:tid', function(context) {
      var tid;
      tid = this.params['tid'];
      return $.ajax({
        url: HOST + 'thread/' + tid,
        dataType: 'json',
        success: function(thread) {
          return context.partial('templates/thread.template', {
            thread: thread
          }).then(function() {
            var render0;
            render0 = function(index) {
              var content, post;
              if (index < thread.posts.length) {
                post = thread.posts[index];
                content = showdown.makeHtml(post.source);
                return context.get_user(post.username, function(post_user) {
                  return context.render('templates/post.template', {
                    post: {
                      content: content,
                      date: format_date(post.date),
                      user: post_user
                    }
                  }).then(function(post) {
                    $(post).hide().appendTo('.thread').fadeIn('slow');
                    return render0(index + 1);
                  });
                });
              } else {
                return context.render('templates/post-reply.template', {
                  post: {
                    user: context.user,
                    tid: tid
                  }
                }).then(function(post) {
                  $(post).hide().appendTo('.thread').fadeIn('slow');
                  this.trigger('setup-post-editor');
                  return $('.submit-post').click(function() {
                    return context.trigger('post-reply', {
                      context: context
                    });
                  });
                });
              }
            };
            return render0(0);
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
        var newpost;
        newpost = $('.new-post');
        if (newpost.css('display') === 'none') {
          return $('.new-post').hide().css('height', '0px').show().animate({
            height: '191px'
          });
        }
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
      var tid;
      context = this;
      tid = $('.reply-thread').val();
      return $.post(HOST + 'post-reply', {
        username: this.user.username,
        tid: tid,
        source: $('.post-source').val()
      }, function(data) {
        var content;
        content = showdown.makeHtml($('.post-source').val());
        return context.render('templates/post.template', {
          post: {
            content: content,
            user: context.user,
            date: format_date(data.date)
          }
        }).then(function(postnode) {
          $(postnode).hide().appendTo('.thread').slideDown();
          $('.new-post').detach().appendTo('.thread');
          $('.post-preview').click();
          return $('.post-source').val('');
        });
      });
    });
    return this.bind('new-thread', function(context) {
      var category, title;
      context = this;
      category = $('.post-category').val();
      title = $('.post-title').val();
      return $.post(HOST + 'new-thread', {
        username: this.user.username,
        category: category,
        title: title,
        source: $('.post-source').val()
      }, function(data) {
        title = $('.new-header .post-title').val();
        context.log(title);
        $('.new-header, .new-post').remove();
        return context.render('templates/thread-summary.template', {
          thread: {
            category: {
              slug: 'blahhh FIXME'
            },
            _id: data.id,
            title: title
          }
        }).then(function(postnode) {
          $(postnode).hide().prependTo('.thread').slideDown();
          return context.render('templates/new-thread.template', {
            post: {
              user: context.user,
              category: category
            }
          }).appendTo('.threads').then(function() {
            this.trigger('setup-thread-opener');
            return this.trigger('setup-post-editor');
          });
        });
      });
    });
  });
  $(function() {
    return app.run('#/');
  });
}).call(this);
