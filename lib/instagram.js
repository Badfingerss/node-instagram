const fs = require('fs');

const cheerio = require('cheerio');
const request = require('request-promise');

const utils = require('../utils.js');

class Instagram {
  constructor(param) {
    param = param || {};
    this.query_id = '17866917712078875';
    this.base = 'https://www.instagram.com/';
    this._sessionId = param.sessionId;
    this._csrftoken = param.csrftoken;
  }

  _request(url, method, option) {
    let options = utils.getPostOption(url, method, this._sessionId,
      this._csrftoken, option || {});

    return request(options).then(data => option.raw ? data : JSON.parse(data));
  }

  _getUserId(targetUserName) {
    return this.fetchUserInfo(targetUserName)
      .then(output => {
        return output.user.id;
      });
  }

  addLike(postId) {
    let url = 'https://www.instagram.com/web/likes/' + postId + '/like/';
    return this._request(url, 'post');
  }

  addComment(postId, text) {
    let url = `https://www.instagram.com/web/comments/${postId}/add/`;

    return this._request(url, 'post', {name: 'addComment', text: text});
  }

  fetchUserPost(targetUserName, count) {
    return this._getUserId(targetUserName)
      .then(userId => this.fetchUserPostById(userId, count))
  }

  fetchUserPostById(targetUserId, count) {
    let url = 'https://www.instagram.com/query/';
    return this._request(url, 'post', {
      name: 'fetchPost',
      targetUserId: targetUserId,
      numOfPost: count,
    });
  }

  _fetchTag(numOfPost, endCursor, count, posts) {
    let url = 'https://www.instagram.com/query/';

    return this._request(url, 'post', {
      name: 'fetchTag',
      tag: tag,
      numOfPost: numOfPost,
      endCursor: endCursor
    })
    .then(output => {
      count.n++;
      posts = posts.concat(output.media.nodes);

      if(count.n < count.total) {
        return this._fetchTag(numOfPost, output.media.page_info.end_cursor,
          count, posts);
      } else {
        return posts;
      }
    });
  }

  fetchTag(tag, numOfPost, iteration) {
    var posts = [];
    let url = 'https://www.instagram.com/explore/tags/' +
      encodeURIComponent(tag) + '/?__a=1';
    
    return this._request(url, 'get', {})
      .then(output => {
        posts = posts.concat(output.tag.media.nodes);
        return output.tag.media.page_info.end_cursor;
      })
      .then(endCursor => {
        if (iteration === 1) {
          return posts;
        } else {
          return this._fetchTag(numOfPost, endCursor, {n: 1, total}, posts);
        }
      });
  }

  _fetchFeed(numOfPost, endCursor, count, posts) {
    let url = 'https://www.instagram.com/graphql/query/?' +
      `query_id=${this.query_id}&fetch_media_item_count=${numOfPost}&` +
      `fetch_media_item_cursor=${endCursor}&` +
      'fetch_comment_count=4&fetch_like=10';

    return this._request(url, 'get', {})
    .then(output => {
      count.n++;
      let feed = output.data.user.edge_web_feed_timeline;
      posts = posts.concat(feed.edges);

      if(count.n < count.total) {
        return this._fetchFeed(numOfPost, feed.page_info.end_cursor,
          count, posts);
      } else {
        return posts;
      }
    });
  }

  fetchFeed(numOfPost, total) {
    let posts = [];
    let endCursor = null;

    return this._request(this.base, 'get', {raw: true})
      .then(body => {
        let $ = cheerio.load(body);
        let s = '';
        $('script').each((i, e) => {
          if (!$(e).attr('src') && $(e).text().indexOf('_sharedData') > 0) {
            s = $(e).text();
          }
        });
        let data = JSON.parse(s.match(/({".*})/)[1]);
        let feed = data.entry_data.FeedPage;
        if (!feed) {
          return false;
        }
        feed = feed[0].graphql.user.edge_web_feed_timeline;
        posts = posts.concat(feed.edges);
        endCursor = feed.page_info.end_cursor;

        let common = $('script[src*="Commons.js"]');
        common = this.base + common.attr('src').slice(1);
        return this._request(common, 'get', {raw: true});
      })
      .then(body => {
        try {
          body = body.slice(body.indexOf(',"graphql_queries/feed/feed'))
          body = body.slice(body.indexOf('{'), body.indexOf('}') + 1)
          let query = body.match(/\w+/g);
          if (query) {
            this.query_id = query[3];
          }
        } catch(e) {}

        if (total === 1) {
          return posts;
        } else {
          return this._fetchFeed(numOfPost, endCursor, {n: 1, total}, posts);
        }
      });
  }

  fetchFollower(targetUserName, numOfFollower) {
    let url = 'https://www.instagram.com/query/';

    return this._getUserId(targetUserName)
      .then(targetUserId => {
        return this._request(url, 'post', {
          name: 'followedBy',
          targetUserId: targetUserId,
          numOfFollower: numOfFollower,
        });
      });
  }

  fetchFollowsById(targetUserId, numOfFollower, cursor) {
    let url = 'https://www.instagram.com/query/';
    return this._request(url, 'post', {
      name: 'follows',
      targetUserId: targetUserId,
      numOfFollower: numOfFollower,
      cursor: cursor
    });
  }

  fetchFollows(targetUserName, count, cursor) {
    return this._getUserId(targetUserName)
      .then(userId => this.fetchFollowsById(userId, count, cursor));
  }

  fetchUserInfo(targetUserName) {
    let url = 'https://www.instagram.com/' + targetUserName + '/?__a=1';
    return this._request(url, 'get');
  }

  fetchPost(code) {
    let url = 'https://www.instagram.com/p/' + code + '/?__a=1'
    return this._request(url, 'get');
  }
}

function login(username, password) {
  let url = 'https://www.instagram.com/accounts/login/ajax/';

  let options = utils.getPostOption(url, 'post', null, null, {
    name: 'login',
    username: username,
    password: password,
  });

  options.transform = (body, response) => {
    return response;
  };

  let csrftoken;
  let sessionid;

  return request(options)
    .then(response => {
      let cookies = response.headers['set-cookie'];
      cookies.forEach(function(cookie) {
        let csrftokenMatch = /csrftoken=(.*?);/g.exec(cookie)
        let sessionidMatch = /sessionid=(.*?);/g.exec(cookie)

        if(csrftokenMatch) {
          csrftoken = csrftokenMatch[1];
        }

        if(sessionidMatch) {
          sessionid = sessionidMatch[1];
        }
      })

      let output = response.body;
      if (typeof response.body !== 'object') {
        try {
          output = JSON.parse(output);
        } catch(e) {
          return Promise.reject("Error: " + e + ", Body: " + body);
        }
      }

      if(output.authenticated === false) {
        return Promise.reject(output);
      }
      
      if(csrftoken && sessionid) {
        output.csrftoken = csrftoken;
        output.sessionid = sessionid;
        return output;
      } else {
        return Promise.reject('csrftoken or sessionid is undefined');
      }
    });
}

module.exports = {
  Instagram: Instagram,
  login: login
};
