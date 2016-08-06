let staticData = {
  fetchPost: function(option) {
    return [
      {
        name: 'q',
        value: 'ig_user(' + option.targetUserId + ') { media.after(0, ' + 
          option.numOfPost + ') { count, nodes { \
          caption, code, comments { count }, \
          date, dimensions { height, width }, display_src, id, is_video, \
          likes { count }, owner { id }, thumbnail_src, video_url, \
          video_views }, page_info } }'
      },
      {
        name: 'ref',
        value: 'users::show'
      }
    ];
  },
  fetchFeed: function(option) {
    return [{
      name: 'q',
      value: 'ig_me() { feed { media.after(' +
        option.endCursor + ', ' + option.numOfPost + ') { \
        nodes { id, caption, code, comments { count }, comments_disabled, \
        date, dimensions { height, width }, display_src, is_video, \
        likes { count, viewer_has_liked }, \
        location { id, has_public_page, name }, \
        owner { id }, usertags { nodes { user { username }, x, y } }, \
        video_url, video_views }, page_info } }, \
        id, profile_pic_url, username }'
      },
      {
        name: 'ref',
        value: 'feed::show'
      }];
  },
  fetchTag: function(option) {
    return [{
      name: 'q',
      value: 'ig_hashtag(' + option.tag + ') { media.after(' +
        option.endCursor + ', ' + option.numOfPost + ') { \
        count, nodes { caption, code, comments { count }, date, \
        dimensions { height, width }, display_src, id, is_video, \
        likes { count }, owner { id }, thumbnail_src, video_views \
        }, page_info } }'
      },
      {
        name: 'ref',
        value: 'users::show'
      }];
  },
  addComment: function(option) {
    return [{
      name: 'comment_text',
      value: option.text
    }]  
  },
  followedBy: function(option) {
    return [{
      name: 'q',
      value: 'ig_user(' + option.targetUserId + ') { \
        followed_by.first(' + option.numOfFollower + ') { \
        count, page_info { end_cursor, has_next_page }, \
        nodes { id, is_verified, followed_by_viewer, requested_by_viewer, \
        full_name, profile_pic_url, username } } }'
    },
    {
      name: 'ref',
      value: 'relationships::follow_list'
    }];
  },
  follows: function(option) {
    let cursor = (option.cursor ? `after(${option.cursor}, ` : 'first(') +
      + option.numOfFollower + ') { ';
    return [{
      name: 'q',
      value: 'ig_user(' + option.targetUserId + ') { \
        follows.' + cursor + 'count, page_info { end_cursor, has_next_page }, \
        nodes { id, biography, external_url, is_verified, followed_by_viewer, \
        requested_by_viewer, full_name, followed_by { count }, \
        media { count }, profile_pic_url, username } } }'
    },
    {
      name: 'ref',
      value: 'relationships::follow_list'
    }];
  },
  login: function(option) {
    return [{
      name: 'username',
      value: option.username
    },
    {
      name: 'password',
      value: option.password
    }];
  }
};

function getPostOption(url, method, sessionId, csrftoken, option) {
  let postOption = {
    har: {
      url: url,
      method: method,
      gzip: true,
      headers: [{
          name: 'origin',
          value: 'https://www.instagram.com'
        },
        {
          name: 'content-type',
          value: 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        {
          name: 'accept',
          value: 'application/json, text/javascript, */*; q=0.01'
        },
        {
          name: 'referer',
          value: 'https://www.instagram.com/'
        },
        {
          name: 'x-csrftoken', 
          value: csrftoken
      }],
      cookies: [{
        name: 'sessionid',
        value: sessionId
      },
      {
        name: 'csrftoken',
        value: csrftoken
      }],
      postData: {
        mimeType: 'application/x-www-form-urlencoded; charset=UTF-8',
        params: []
      }
    }
  }

  if(option.name) {
    postOption.har.postData.params = staticData[option.name](option)
  }

  return postOption;
}

module.exports = {
  getPostOption: getPostOption
};
