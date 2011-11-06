# Simple sammy test in CS :)

HOST = 'http://192.168.1.64:3000/'
showdown = new Showdown.converter()

app = $.sammy '#main', ->
  @use 'Template'

  @bind 'render-all', (event, args) ->
    @load(HOST + args.path, { json: true }).then (content) ->
      @renderEach(args.template, args.name, content).appendTo(args.target)

  @get '#/', (context) ->
    context.app.swap ''
    @partial('templates/home.template')
    @trigger 'render-all', {
      path: 'categories'
      template: 'templates/category-summary.template'
      name: 'category'
      target: '.categories'
    }

  @get '#/:slug', (context) ->
    me = {nickname: "BlueSky", slogan: "Win j'en ai eu ma dows, COMME MA BITE", avatar: "/stylesheets/avatar2.png"}
    him = {nickname: "Sylvain", slogan: "Mousse de canard", avatar: "/stylesheets/avatar1.png"}
    slug = @params['slug']

    @load(HOST + 'category/' + slug, { json: true }).then (category) ->
      context.partial 'templates/category.template', { category: category }
      context.render('templates/new-thread.template', { post: { user: me, category: category._id }}).appendTo('.threads').then ->
        @trigger 'setup-thread-opener'
        @trigger 'setup-post-editor'
        category.threads.forEach (thread) -> thread.category = category
        @renderEach('templates/thread-summary.template', 'thread', category.threads).appendTo('.threads')

  @get '#/:slug/:tid', (context) ->
    tid = @params['tid']
    $.ajax({
      url: HOST + 'thread/' + tid
      dataType: 'json'
      success: (thread) ->
        user = {
          nickname: thread.nickname
          slogan: "Un pour tous, tous pour un"
          avatar: ""
        }
        context.partial('templates/thread.template', {thread: thread}).then ->
          render0 = (index) ->
            if index < thread.posts.length
              post = thread.posts[index]
              content = showdown.makeHtml(post.source)
              context.render('templates/post.template', {post: {content: content, user: user}}).appendTo('.thread').then ->
                render0(index + 1)
            else
              context.render('templates/post-reply.template', {post: {user: user, tid: tid}}).appendTo('.thread').then ->
                @trigger 'setup-post-editor'
                $('.submit-post').click ->
                  context.trigger 'post-reply'
          render0(0)
    })

  @bind 'setup-thread-opener', ->
    context = @
    $('.post-title').blur ->
      if $(this).val() == ""
        $('.new-post').slideUp()

    $('.post-title').focus ->
      $('.new-post').slideDown()

    $('.submit-post').click ->
      context.trigger 'new-thread'

  @bind 'setup-post-editor', ->
    context = @
    $('.post-source').blur ->
      source = $(this)
      source.hide()
      preview = source.parent().children('.post-preview')
      preview.html(showdown.makeHtml(source.val())).show()

    $('.post-preview').click ->
      preview = $(this)
      preview.hide()
      source = preview.parent().children('.post-source')
      source.show().focus()

  @bind 'post-reply', (context) ->
    $.post HOST + 'post-reply', {
        username: "bluesky"
        tid: $('.reply-thread').val()
        source: $('.post-source').val()
    }, (data) ->
      alert("post reply successful")

  @bind 'new-thread', (context) ->
    $.post HOST + 'new-thread', {
        username: "bluesky"
        category: $('.post-category').val()
        title: $('.post-title').val()
        source: $('.post-source').val()
    }, (data) ->
      alert("new thread successful")

$ -> app.run '#/'
