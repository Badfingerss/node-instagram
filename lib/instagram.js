const fs = require('fs');

const cheerio = require('cheerio');
const request = require('request-promise');

const utils = require('../utils.js');

class Instagram {
  constructor(param) {
    param = param || {};
    this.query_hash = '485c25657308f08317c1e4b967356828';
    this.follow_hash = '17874545323001329';
    this.base = 'https://www.instagram.com/';
    this._sessionId = param.sessionId;
    this._csrftoken = param.csrftoken;
  }

  init() {
    let consumer = '';
    return this._request(this.base, 'get', {raw: true})
      .then((body) => {
        let $ = cheerio.load(body);
        let common = $('script[src*="Commons.js"]');
        consumer = $('script[src*="Consumer.js"]');
        common = this.base + common.attr('src').slice(1);
        consumer = this.base + consumer.attr('src').slice(1);
        return this._request(common, 'get', {raw: true});
      })
      .then((body) => {
        try {
          const feed = body.slice(0, body.lastIndexOf('edge_web_feed_timeline'));
          const hash = feed.match(/\w="\w{32}",\w="\w{32}",\w="\w{32}"/g);
          this.query_hash = hash[0].slice(3, 35);
        } catch (e) {}
        return this._request(consumer, 'get', {raw: true});
      })
      .then((body) => {
        try {
          const follow = body.slice(0, body.lastIndexOf('edge_follow'));
          const hash = follow.match(/"\w{32}"/g);
          this.follow_hash = hash[hash.length - 1].slice(1, -1);
        } catch (e) {}
      });
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
    if (!this.query_hash) {
      return Promise.reject('No query_hash');
    }

    let url = 'https://www.instagram.com/graphql/query/?' +
      `query_hash=${this.query_hash}&fetch_media_item_count=${numOfPost}&` +
      (endCursor ? `fetch_media_item_cursor=${endCursor}&` : '') +
      'fetch_comment_count=4&fetch_like=10';

    return this._request(url, 'get', {})
    .then(output => {
      count.n++;
      let feed = output.data.user.edge_web_feed_timeline;
      posts = posts.concat(feed.edges);

      if (count.n < count.total && feed.page_info.has_next_page) {
        return this._fetchFeed(numOfPost, feed.page_info.end_cursor,
          count, posts);
      } else {
        return posts;
      }
    })
    .catch(e => {});
  }

  fetchFeed(numOfPost, total) {
    return this._fetchFeed(numOfPost, '', {n: 0, total}, []);
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
    let url = 'https://www.instagram.com/graphql/query/?' +
      `query_hash=${this.follow_hash}&id=${targetUserId}&`+
      `first=${numOfFollower}${cursor ? `&after=${cursor}` : ''}`;

    return this._request(url, 'get', {})
    .then((output) => {
      return output.data.user.edge_follow;
    })
    .catch(e => {});
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
